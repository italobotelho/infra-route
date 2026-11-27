"""
Testes automatizados para validação robusta de CREA (formato, UF, dígitos, sufixo,
normalização no cadastro, unicidade, cache TTL e provedor HTTP externo com fallback).
"""

import unittest
from pydantic import ValidationError

from backend.models.schemas import RegistroRequestSchema
from backend.services.crea_validation_service import (
    CreaValidationService,
    validar_e_normalizar_crea,
)
from backend.services.exceptions import ValidacaoDominioError
from backend.services.governanca_service import Usuario
from backend.services.workspace_store import WorkspaceStoreService


class TestCreaValidation(unittest.TestCase):
    def test_01_formatos_validos_e_normalizacao(self) -> None:
        casos = [
            ("SP-5060708090", None, "SP-5060708090", "SP", "5060708090", None),
            ("pr-40112233", None, "PR-40112233", "PR", "40112233", None),
            ("MG-123456/D", None, "MG-123456/D", "MG", "123456", "D"),
            ("rj 987654/p", None, "RJ-987654/P", "RJ", "987654", "P"),
            ("CREA-BA 12345678", None, "BA-12345678", "BA", "12345678", None),
            ("5544332211", "SP", "SP-5544332211", "SP", "5544332211", None),
            ("5544332211", None, "5544332211", None, "5544332211", None),
        ]
        for bruto, uf_padrao, esperado, uf_esp, num_esp, suf_esp in casos:
            res = validar_e_normalizar_crea(bruto, uf_padrao=uf_padrao)
            self.assertTrue(res.valido)
            self.assertEqual(res.crea_normalizado, esperado)
            self.assertEqual(res.uf, uf_esp)
            self.assertEqual(res.numero, num_esp)
            self.assertEqual(res.sufixo, suf_esp)

    def test_02_formatos_invalidos_rejeitados(self) -> None:
        invalidos = [
            "",
            "   ",
            "12345",          # < 6 dígitos
            "SP-12345",       # < 6 dígitos
            "SP-12345678901", # > 10 dígitos
            "SP-000000",      # dígitos repetidos
            "MG-11111111",    # dígitos repetidos
            "XX-123456",      # UF inexistente
            "SP-123456/X",    # sufixo inválido
            "SP-12A456",      # letras no número
        ]
        for bruto in invalidos:
            with self.assertRaises(ValidacaoDominioError, msg=f"Deveria rejeitar: {bruto!r}"):
                validar_e_normalizar_crea(bruto)

    def test_03_schema_pydantic_e_entidade_usuario_rejeitam_crea_invalido(self) -> None:
        with self.assertRaises(ValidationError):
            RegistroRequestSchema(
                nome="Engenheiro Teste",
                email="eng.teste@empresa.com.br",
                senha="SenhaForte123!",
                telefone="(19) 99999-0000",
                cpf="321.654.987-00",
                crea="XX-123456",
            )

        with self.assertRaises(ValidationError):
            RegistroRequestSchema(
                nome="Engenheiro Teste",
                email="eng.teste@empresa.com.br",
                senha="SenhaForte123!",
                telefone="(19) 99999-0000",
                cpf="321.654.987-00",
                crea="SP-000000",
            )

        with self.assertRaises(ValidacaoDominioError):
            Usuario(
                id_usuario=99,
                nome="Engenheiro Teste",
                cpf="321.654.987-00",
                telefone="(19) 99999-0000",
                email="eng.teste@empresa.com.br",
                crea="ZZ-123456",
            )

    def test_04_cadastro_preserva_uf_e_bloqueia_duplicidade_normalizada(self) -> None:
        store = WorkspaceStoreService()
        sessao = store.registrar_usuario(
            nome="Eng. Paranaense",
            email="pr.eng@empresa.com.br",
            senha="SenhaForte123!",
            telefone="(41) 99999-1111",
            cpf="321.654.987-00",
            crea="crea-pr 99887766/d",
        )
        self.assertEqual(sessao.crea, "PR-99887766/D")

        with self.assertRaisesRegex(ValidacaoDominioError, "CREA"):
            store.registrar_usuario(
                nome="Outro Engenheiro",
                email="outro.eng@empresa.com.br",
                senha="SenhaForte123!",
                telefone="(41) 99999-2222",
                cpf="456.789.012-34",
                crea="PR-99887766/D",
            )

    def test_05_provedor_http_cache_e_fallback_resiliente(self) -> None:
        chamadas = []

        def fetcher_ativo(url, payload, headers, timeout):
            chamadas.append(payload["crea"])
            return {"valido": True, "situacao": "ATIVO", "detalhes": "Regular no conselho."}

        svc_ativo = CreaValidationService(
            provider="http",
            api_url="https://api.exemplo.local/crea",
            api_token="tok-123",
            cache_ttl_seconds=60,
            http_fetcher=fetcher_ativo,
        )
        r1 = svc_ativo.validar_registro("MG-123456")
        r2 = svc_ativo.validar_registro("mg 123456")
        self.assertEqual(r1.provedor, "http")
        self.assertEqual(r1.situacao, "ATIVO")
        self.assertEqual(r2.crea_normalizado, "MG-123456")
        self.assertEqual(len(chamadas), 1)  # Cache TTL evitou 2a chamada

        def fetcher_suspenso(url, payload, headers, timeout):
            return {"valido": False, "situacao": "SUSPENSO"}

        svc_suspenso = CreaValidationService(
            provider="http",
            api_url="https://api.exemplo.local/crea",
            http_fetcher=fetcher_suspenso,
        )
        with self.assertRaisesRegex(ValidacaoDominioError, "SUSPENSO"):
            svc_suspenso.validar_registro("SP-654321")

        def fetcher_erro(url, payload, headers, timeout):
            raise TimeoutError("Tempo limite excedido")

        svc_fallback = CreaValidationService(
            provider="http",
            api_url="https://api.exemplo.local/crea",
            strict_mode=False,
            http_fetcher=fetcher_erro,
        )
        r_fb = svc_fallback.validar_registro("RJ-654321")
        self.assertTrue(r_fb.valido)
        self.assertEqual(r_fb.provedor, "http_fallback_local")
        self.assertEqual(r_fb.situacao, "INDISPONIVEL")

        svc_strict = CreaValidationService(
            provider="http",
            api_url="https://api.exemplo.local/crea",
            strict_mode=True,
            http_fetcher=fetcher_erro,
        )
        with self.assertRaises(ValidacaoDominioError):
            svc_strict.validar_registro("RJ-654321")


if __name__ == "__main__":
    unittest.main()

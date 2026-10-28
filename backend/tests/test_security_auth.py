"""
Suíte de Testes de Segurança: Criptografia de Senhas (bcrypt) e Autenticação JWT (HS256).
"""

import unittest

from backend.controllers.auth_controller import (
    autenticar_colaborador,
    exigir_sessao_autenticada,
    obter_sessao_opcional,
    obter_usuario_atual,
    registrar_colaborador,
)
from backend.models.schemas import LoginRequestSchema, RegistroRequestSchema
from backend.services.exceptions import (
    NaoAutenticadoError,
    ValidacaoDominioError,
    ViolacaoMultiTenantError,
)
from backend.services.security_service import (
    decodificar_token_acesso,
    gerar_hash_senha,
    gerar_token_acesso,
    verificar_senha,
)
from backend.services.workspace_store import WorkspaceStoreService


class TestSegurancaBcryptEJwt(unittest.TestCase):
    def setUp(self) -> None:
        self.store = WorkspaceStoreService()

    def test_01_bcrypt_gera_hashes_salgados_unicos_e_valida_em_tempo_constante(self) -> None:
        senha = "SenhaSuperSegura!2026"
        hash_1 = gerar_hash_senha(senha, rounds=4)
        hash_2 = gerar_hash_senha(senha, rounds=4)

        self.assertTrue(hash_1.startswith("$2b$04$"))
        self.assertTrue(hash_2.startswith("$2b$04$"))
        # Mesmo com a mesma senha, os salts aleatórios devem produzir hashes distintos
        self.assertNotEqual(hash_1, hash_2)
        self.assertNotEqual(hash_1, senha)

        self.assertTrue(verificar_senha(senha, hash_1))
        self.assertTrue(verificar_senha(senha, hash_2))
        self.assertFalse(verificar_senha("SenhaErrada!2026", hash_1))
        self.assertFalse(verificar_senha("", hash_1))
        self.assertFalse(verificar_senha(senha, "hash_invalido_corrompido"))

    def test_02_bcrypt_bloqueia_senha_vazia_ou_acima_de_72_bytes(self) -> None:
        with self.assertRaises(ValidacaoDominioError):
            gerar_hash_senha("")

        senha_73_bytes = "A" * 73
        with self.assertRaises(ValidacaoDominioError):
            gerar_hash_senha(senha_73_bytes)

        self.assertFalse(verificar_senha(senha_73_bytes, gerar_hash_senha(" Valida123!", rounds=4)))

    def test_03_workspace_store_nunca_armazena_senha_em_texto_plano(self) -> None:
        # 1. Verifica que os usuários seed já estão com hash bcrypt ($2b$...)
        for id_usr, hash_salvo in self.store._senhas_usuarios.items():
            self.assertTrue(
                hash_salvo.startswith("$2b$"),
                f"Usuário {id_usr} deveria armazenar hash bcrypt, mas encontrou: {hash_salvo}",
            )
            self.assertNotEqual(hash_salvo, "123456")

        # 2. Cadastra um novo engenheiro e garante que a senha é persistida como hash bcrypt
        sessao = self.store.registrar_usuario(
            nome="Carlos Criptografia",
            email="carlos.sec@empresa.com.br",
            senha="MinhaSenhaSecreta#99",
            telefone="(19) 97777-6666",
            cpf="321.654.987-00",
            crea="5544332211",
        )
        hash_novo = self.store._senhas_usuarios[sessao.id_usuario]
        self.assertTrue(hash_novo.startswith("$2b$"))
        self.assertNotEqual(hash_novo, "MinhaSenhaSecreta#99")
        self.assertTrue(verificar_senha("MinhaSenhaSecreta#99", hash_novo))

    def test_04_jwt_emissao_decodificacao_e_bloqueio_de_adulteracao_ou_expiracao(self) -> None:
        token = gerar_token_acesso(
            id_usuario=1,
            email="engenheiro@empresa.com.br",
            id_empresa=1,
            nivel_acesso="Administrador",
            eh_engenheiro=True,
            expiracao_segundos=3600,
            agora_timestamp=1700000000,
        )
        claims = decodificar_token_acesso(token, agora_timestamp=1700001800)
        self.assertEqual(claims.id_usuario, 1)
        self.assertEqual(claims.email, "engenheiro@empresa.com.br")
        self.assertEqual(claims.id_empresa, 1)
        self.assertEqual(claims.nivel_acesso, "Administrador")
        self.assertTrue(claims.eh_engenheiro)

        # Token expirado deve lançar NaoAutenticadoError (HTTP 401)
        with self.assertRaises(NaoAutenticadoError) as ctx:
            decodificar_token_acesso(token, agora_timestamp=1700003601)
        self.assertEqual(ctx.exception.codigo_http, 401)

        # Adulteração da assinatura deve ser rejeitada
        partes = token.split(".")
        token_adulterado = f"{partes[0]}.{partes[1]}.assinaturaInvalida123"
        with self.assertRaises(NaoAutenticadoError):
            decodificar_token_acesso(token_adulterado, agora_timestamp=1700001800)

        # Chave secreta incorreta deve rejeitar o token
        with self.assertRaises(NaoAutenticadoError):
            decodificar_token_acesso(
                token,
                secret_key="outra-chave-invalida",
                agora_timestamp=1700001800,
            )

    def test_05_fluxo_completo_login_emite_token_e_valida_sessao(self) -> None:
        sessao = self.store.autenticar_usuario("engenheiro@empresa.com.br", "123456")
        self.assertTrue(sessao.access_token)
        self.assertEqual(sessao.token_type, "bearer")

        sessao_validada = self.store.validar_token_sessao(sessao.access_token)
        self.assertEqual(sessao_validada.id_usuario, sessao.id_usuario)
        self.assertEqual(sessao_validada.email, sessao.email)
        self.assertEqual(sessao_validada.nivel_acesso, "Administrador")

        # Verifica exigência de autenticação quando não há token
        with self.assertRaises(NaoAutenticadoError):
            exigir_sessao_autenticada(None)


if __name__ == "__main__":
    unittest.main()

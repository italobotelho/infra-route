"""
Suíte de Testes de Segurança:
1. Criptografia de Senhas (bcrypt)
2. Autenticação JWT (HS256) e Expiração
3. Rate Limiting / Proteção contra Força Bruta (HTTP 429)
4. Revogação Real de Token no Logout (Token Denylist / JTI - HTTP 401)
5. Defesa em Profundidade no Backend (Complexidade de Senha e CPF Módulo 11)
6. Verificação de E-mail Gratuita (OTP de 6 dígitos) e Trilha de Auditoria
"""

import unittest

from pydantic import ValidationError

from backend.controllers.auth_controller import exigir_sessao_autenticada
from backend.models.schemas import RegistroRequestSchema
from backend.services.exceptions import (
    LimiteRequisicoesExcedidoError,
    NaoAutenticadoError,
    ValidacaoDominioError,
    ViolacaoMultiTenantError,
)
from backend.services.security_service import (
    decodificar_token_acesso,
    gerar_hash_senha,
    gerar_token_acesso,
    validar_digitos_verificadores_cpf,
    validar_forca_senha,
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

        self.assertFalse(verificar_senha(senha_73_bytes, gerar_hash_senha("Valida123!", rounds=4)))

    def test_03_workspace_store_nunca_armazena_senha_em_texto_plano(self) -> None:
        for id_usr, hash_salvo in self.store._senhas_usuarios.items():
            self.assertTrue(
                hash_salvo.startswith("$2b$"),
                f"Usuário {id_usr} deveria armazenar hash bcrypt, mas encontrou: {hash_salvo}",
            )
            self.assertNotEqual(hash_salvo, "123456")

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
        self.assertTrue(claims.jti)

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

        with self.assertRaises(NaoAutenticadoError):
            exigir_sessao_autenticada(None)

    def test_06_rate_limiting_bloqueia_forca_bruta_apos_5_falhas(self) -> None:
        # 5 tentativas incorretas retornam 403 (ViolacaoMultiTenantError)
        for _ in range(5):
            with self.assertRaises(ViolacaoMultiTenantError):
                self.store.autenticar_usuario("engenheiro@empresa.com.br", "senha_errada")

        # Na 6ª tentativa, mesmo com a senha CORRETA, a conta está temporariamente bloqueada (HTTP 429)
        with self.assertRaises(LimiteRequisicoesExcedidoError) as ctx:
            self.store.autenticar_usuario("engenheiro@empresa.com.br", "123456")
        self.assertEqual(ctx.exception.codigo_http, 429)

    def test_07_revogacao_token_no_logout_invalida_jwt_imediatamente(self) -> None:
        sessao = self.store.autenticar_usuario("engenheiro@empresa.com.br", "123456")
        token = sessao.access_token

        # Antes do logout o token é aceito
        self.assertEqual(self.store.validar_token_sessao(token).id_usuario, 1)

        # Executa logout (revoga o JTI na Denylist)
        self.store.revogar_token_sessao(token)

        # Após o logout, qualquer tentativa de usar o mesmo token lança 401 NaoAutenticadoError
        with self.assertRaises(NaoAutenticadoError) as ctx:
            self.store.validar_token_sessao(token)
        self.assertEqual(ctx.exception.codigo_http, 401)

    def test_08_defesa_em_profundidade_complexidade_senha_e_cpf_no_backend(self) -> None:
        # Senhas fracas (apenas números ou apenas minúsculas) devem ser bloqueadas
        with self.assertRaises(ValidacaoDominioError):
            validar_forca_senha("12345678")
        with self.assertRaises(ValidacaoDominioError):
            validar_forca_senha("abcdefgh")

        # Validação via Schema Pydantic (bloqueia requisição direta na API)
        with self.assertRaises(ValidationError):
            RegistroRequestSchema(
                nome="Engenheiro Fraco",
                email="fraco@empresa.com.br",
                senha="12345678",
                telefone="(19) 99999-0000",
                cpf="321.654.987-00",
                crea="123456",
            )

        with self.assertRaises(ValidationError):
            RegistroRequestSchema(
                nome="Engenheiro CPF Repetido",
                email="cpf@empresa.com.br",
                senha="SenhaForte123!",
                telefone="(19) 99999-0000",
                cpf="111.111.111-11",
                crea="123456",
            )

        # Validador matemático Módulo 11 de CPF
        self.assertTrue(validar_digitos_verificadores_cpf("529.982.247-25"))
        self.assertFalse(validar_digitos_verificadores_cpf("111.111.111-11"))
        self.assertFalse(validar_digitos_verificadores_cpf("529.982.247-00"))

    def test_09_verificacao_email_otp_6_digitos_e_trilha_de_auditoria(self) -> None:
        sessao = self.store.registrar_usuario(
            nome="Dra. Helena OTP",
            email="helena@empresa.com.br",
            senha="SenhaForte#2026",
            telefone="(19) 98888-7777",
            cpf="654.321.987-00",
            crea="987654321",
        )
        # Recém-cadastrada: e-mail aguarda confirmação OTP
        self.assertFalse(sessao.email_verificado)
        self.assertIsNotNone(sessao.codigo_verificacao_dev)
        self.assertEqual(len(sessao.codigo_verificacao_dev), 6)

        # Código errado é rejeitado
        with self.assertRaises(ValidacaoDominioError):
            self.store.verificar_email_usuario("helena@empresa.com.br", "000000")

        # Código correto confirma o e-mail
        sessao_confirmada = self.store.verificar_email_usuario(
            "helena@empresa.com.br", sessao.codigo_verificacao_dev
        )
        self.assertTrue(sessao_confirmada.email_verificado)
        self.assertIsNone(sessao_confirmada.codigo_verificacao_dev)

        # Verifica que a trilha de auditoria registrou os eventos de segurança
        eventos = self.store.listar_eventos_auditoria(id_usuario_autor=1)
        acoes = [ev.acao for ev in eventos]
        self.assertIn("CADASTRO_USUARIO", acoes)
        self.assertIn("LOGIN_SUCESSO", acoes)
        self.assertIn("EMAIL_VERIFICADO", acoes)


if __name__ == "__main__":
    unittest.main()

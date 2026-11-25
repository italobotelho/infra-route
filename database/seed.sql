-- ==============================================================================
-- DADOS INICIAIS (SEED) PARA AMBIENTE DE DESENVOLVIMENTO E TESTES (SRID 4326)
-- ==============================================================================

-- 1. Empresas (Multi-Tenant) e Usuários / Engenheiros (5 Perfis de Demonstração)
INSERT INTO Empresa (CNPJ, Razao_Social) VALUES
('12.345.678/0001-90', 'InfraTelecom Engenharia Óptica S.A.'),
('98.765.432/0001-10', 'ConectaSul Fibra Ltda.');

-- Senha padrão ('123456') criptografada com bcrypt ($2b$12$...)
INSERT INTO Usuario (Nome, CPF, Telefone, Email, Senha, Email_Verificado) VALUES
('Engenheiro Responsável', '123.456.789-00', '(19) 99999-0000', 'engenheiro@empresa.com.br', '$2b$12$.pPzTtLhpmO8sCHgHeSRreawoJC/cr9iyCHI1MTrZeA1R.C1zdKPS', TRUE),
('Analista Visualizador', '234.567.890-11', '(19) 98888-1111', 'auditor@empresa.com.br', '$2b$12$.pPzTtLhpmO8sCHgHeSRreawoJC/cr9iyCHI1MTrZeA1R.C1zdKPS', TRUE),
('Eng. Marina Alves', '345.678.901-22', '(19) 98765-4321', 'projetista@empresa.com.br', '$2b$12$.pPzTtLhpmO8sCHgHeSRreawoJC/cr9iyCHI1MTrZeA1R.C1zdKPS', TRUE),
('Eng. Helena Costa', '456.789.012-33', '(41) 99123-4567', 'gestor@conectasul.com.br', '$2b$12$.pPzTtLhpmO8sCHgHeSRreawoJC/cr9iyCHI1MTrZeA1R.C1zdKPS', TRUE),
('Auditor SecOps Global', '567.890.123-44', '(11) 99000-0001', 'secops@infraroute.com.br', '$2b$12$.pPzTtLhpmO8sCHgHeSRreawoJC/cr9iyCHI1MTrZeA1R.C1zdKPS', TRUE);

INSERT INTO Engenheiro (ID_Usuario, CREA) VALUES
(1, 'SP-5060708090'),
(3, 'SP-50887766'),
(4, 'PR-40112233');

INSERT INTO Vincula (ID_Usuario, ID_Empresa, Nivel_Acesso) VALUES
(1, 1, 'Administrador'),
(2, 1, 'Visualizador'),
(3, 1, 'Projetista'),
(4, 2, 'Administrador'),
(5, 1, 'SuperAdmin');

-- 2. Catálogo de Equipamentos e Cabos
INSERT INTO Tipo_Equipamento (Custo_Unitario, Categoria, Fabricante) VALUES
(380.00, 'CTO', 'Furukawa'),
(520.00, 'Caixa de Emenda', 'Furukawa'),
(2450.00, 'Switch', 'Huawei');

INSERT INTO Tipo_Cabo (Descricao_Modelo, Custo_Por_Metro, Limite_Distancia_Metros) VALUES
('Fibra AS-80 12FO', 4.50, 2000.00),
('Fibra AS-120 24FO', 6.80, 5000.00);

-- 3. Projetos Iniciais (Empresa 1 e Empresa 2)
INSERT INTO Projeto (Nome, Status, Custo_Estimado, Metragem_Total, idEmpresa, idEngenheiro) VALUES
('Expansão Distrito Industrial', 'Em Planejamento', 3372.25, 120.50, 1, 1),
('Malha Centro Histórico', 'Em Execução', 1890.00, 210.00, 1, 1),
('Backbone Sul Curitiba', 'Em Planejamento', 2830.00, 150.00, 2, 4);

-- 4. Pontos de Rede (SRID 4326 - Longitude, Latitude)
INSERT INTO Ponto_Rede (Descricao, Geometria_Espacial, Status_Fisico, idTipo_Equipamento) VALUES
('Ponto #101 (POP Central)', ST_SetSRID(ST_MakePoint(-46.9852, -22.7045), 4326), 'Instalado', 3),
('Ponto #102 (Poste Concreto)', ST_SetSRID(ST_MakePoint(-46.9845, -22.7054), 4326), 'Projetado', 1),
('POP Curitiba Centro', ST_SetSRID(ST_MakePoint(-49.2733, -25.4284), 4326), 'Instalado', 3),
('CTO Batel #01', ST_SetSRID(ST_MakePoint(-49.2862, -25.4395), 4326), 'Projetado', 1);

INSERT INTO Contem (ID_Ponto, ID_Projeto, Status_Ponto) VALUES
(1, 1, 'Ativo'),
(2, 1, 'Ativo'),
(3, 3, 'Ativo'),
(4, 3, 'Ativo');

-- 5. Trecho de Rede Inicial (LineString SRID 4326)
INSERT INTO Trecho_Rede (Geometria_Linha, Distancia_Metros, Custo_Trecho, Origem_ID, Destino_ID, idProjeto, idTipo_Cabo) VALUES
(
  ST_SetSRID(
    ST_MakeLine(
      ST_MakePoint(-46.9852, -22.7045),
      ST_MakePoint(-46.9845, -22.7054)
    ),
    4326
  ),
  120.50,
  542.25,
  1,
  2,
  1,
  1
);

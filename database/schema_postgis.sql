-- ==============================================================================
-- 1. IMPORTAÇÃO DE BIBLIOTECAS (EXTENSÕES)
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;

-- ==============================================================================
-- 2. CRIAÇÃO DOS TIPOS ENUMERADOS (ENUMS)
-- ==============================================================================
CREATE TYPE enum_status_projeto AS ENUM ('Em Planejamento', 'Em Execução', 'Concluído', 'Cancelado');
CREATE TYPE enum_status_fisico AS ENUM ('Projetado', 'Instalado', 'Em Manutenção', 'Desativado');
CREATE TYPE enum_categoria_equip AS ENUM ('Caixa de Emenda', 'CTO', 'Switch', 'Passivo de Passagem', 'Outro');
CREATE TYPE enum_fabricante AS ENUM ('Furukawa', 'Intelbras', 'Huawei', 'Cisco', 'Outro');
CREATE TYPE enum_status_ponto AS ENUM ('Ativo', 'Inativo', 'Removido');
CREATE TYPE enum_nivel_acesso AS ENUM ('SuperAdmin', 'Administrador', 'Projetista', 'Visualizador');

-- ==============================================================================
-- 3. CRIAÇÃO DAS TABELAS COM RESTRIÇÕES DE INTEGRIDADE (NOT NULL / DEFAULT / CHECK)
-- ==============================================================================
CREATE TABLE Empresa 
( 
 ID_Empresa SERIAL PRIMARY KEY,  
 CNPJ VARCHAR(18) NOT NULL UNIQUE,  
 Razao_Social VARCHAR(255) NOT NULL
); 

CREATE TABLE Usuario 
( 
 ID_Usuario SERIAL PRIMARY KEY,  
 Nome VARCHAR(255) NOT NULL,  
 CPF VARCHAR(14) NOT NULL UNIQUE,
 Telefone VARCHAR(20) NOT NULL,  
 Email VARCHAR(255) NOT NULL UNIQUE,
 Senha VARCHAR(255) NOT NULL,
 Email_Verificado BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE Engenheiro 
( 
 ID_Usuario INT PRIMARY KEY,  
 CREA VARCHAR(50) NOT NULL UNIQUE,
 FOREIGN KEY (ID_Usuario) REFERENCES Usuario (ID_Usuario) ON DELETE CASCADE
); 

CREATE TABLE Projeto 
( 
 ID_Projeto SERIAL PRIMARY KEY,  
 Nome VARCHAR(255) NOT NULL,  
 Status enum_status_projeto NOT NULL DEFAULT 'Em Planejamento',  
 Data_Criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,  
 Custo_Estimado NUMERIC(15,2) NOT NULL DEFAULT 0.00,  
 Metragem_Total NUMERIC(15,2) NOT NULL DEFAULT 0.00,  
 idEmpresa INT NOT NULL,  
 idEngenheiro INT NOT NULL,
 FOREIGN KEY (idEmpresa) REFERENCES Empresa (ID_Empresa) ON DELETE RESTRICT,
 FOREIGN KEY (idEngenheiro) REFERENCES Engenheiro (ID_Usuario) ON DELETE RESTRICT
); 

CREATE TABLE Vincula 
( 
 ID_Usuario INT NOT NULL,  
 ID_Empresa INT NOT NULL,  
 Data_Vinculo DATE NOT NULL DEFAULT CURRENT_DATE,  
 Nivel_Acesso enum_nivel_acesso NOT NULL,
 PRIMARY KEY (ID_Usuario, ID_Empresa),
 FOREIGN KEY (ID_Usuario) REFERENCES Usuario (ID_Usuario) ON DELETE CASCADE,
 FOREIGN KEY (ID_Empresa) REFERENCES Empresa (ID_Empresa) ON DELETE CASCADE
); 

CREATE TABLE Tipo_Equipamento 
( 
 ID_Tipo_Equipamento SERIAL PRIMARY KEY,  
 Custo_Unitario NUMERIC(15,2) NOT NULL CHECK (Custo_Unitario >= 0),  
 Categoria enum_categoria_equip NOT NULL,  
 Fabricante enum_fabricante NOT NULL
);

CREATE TABLE Ponto_Rede 
( 
 ID_Ponto SERIAL PRIMARY KEY,  
 Descricao VARCHAR(255) NOT NULL,  
 Geometria_Espacial GEOMETRY(Point, 4326) NOT NULL,  
 Status_Fisico enum_status_fisico NOT NULL DEFAULT 'Projetado',  
 Data_Instalacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,  
 idTipo_Equipamento INT,
 FOREIGN KEY (idTipo_Equipamento) REFERENCES Tipo_Equipamento (ID_Tipo_Equipamento) ON DELETE SET NULL
); 

CREATE TABLE Contem 
( 
 ID_Ponto INT NOT NULL,  
 ID_Projeto INT NOT NULL,  
 Data_Inclusao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,  
 Status_Ponto enum_status_ponto NOT NULL DEFAULT 'Ativo',
 PRIMARY KEY (ID_Ponto, ID_Projeto),
 FOREIGN KEY (ID_Ponto) REFERENCES Ponto_Rede (ID_Ponto) ON DELETE CASCADE,
 FOREIGN KEY (ID_Projeto) REFERENCES Projeto (ID_Projeto) ON DELETE CASCADE
); 

CREATE TABLE Tipo_Cabo 
( 
 ID_Cabo SERIAL PRIMARY KEY,  
 Descricao_Modelo VARCHAR(255) NOT NULL,  
 Custo_Por_Metro NUMERIC(15,2) NOT NULL CHECK (Custo_Por_Metro >= 0),  
 Limite_Distancia_Metros NUMERIC(15,2) NOT NULL CHECK (Limite_Distancia_Metros > 0)
); 

CREATE TABLE Trecho_Rede 
( 
 ID_Trecho SERIAL PRIMARY KEY,
 Geometria_Linha GEOMETRY(LineString, 4326) NOT NULL,
 Caminho_JSON TEXT NULL,
 Distancia_Metros NUMERIC(15,2) NOT NULL CHECK (Distancia_Metros > 0),
 Custo_Trecho NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (Custo_Trecho >= 0),
 Origem_ID INT NOT NULL,
 Destino_ID INT NOT NULL,
 idProjeto INT NOT NULL,
 idTipo_Cabo INT NOT NULL,
 CONSTRAINT chk_nos_diferentes CHECK (Origem_ID <> Destino_ID),
 FOREIGN KEY (Origem_ID) REFERENCES Ponto_Rede (ID_Ponto) ON DELETE RESTRICT,
 FOREIGN KEY (Destino_ID) REFERENCES Ponto_Rede (ID_Ponto) ON DELETE RESTRICT,
 FOREIGN KEY (idProjeto) REFERENCES Projeto (ID_Projeto) ON DELETE CASCADE,
 FOREIGN KEY (idTipo_Cabo) REFERENCES Tipo_Cabo (ID_Cabo) ON DELETE RESTRICT
);

CREATE TABLE Log_Auditoria
(
 ID_Evento SERIAL PRIMARY KEY,
 Timestamp_UTC TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 Acao VARCHAR(80) NOT NULL,
 ID_Usuario INT NULL,
 Email_Usuario VARCHAR(255) NULL,
 ID_Empresa INT NULL,
 Severidade VARCHAR(20) NOT NULL DEFAULT 'INFO',
 Metodo_HTTP VARCHAR(10) NULL,
 Caminho_HTTP VARCHAR(255) NULL,
 Status_HTTP INT NULL,
 Duracao_Ms NUMERIC(10,2) NULL,
 IP_Origem VARCHAR(64) NULL,
 Detalhes TEXT NOT NULL,
 FOREIGN KEY (ID_Usuario) REFERENCES Usuario (ID_Usuario) ON DELETE SET NULL,
 FOREIGN KEY (ID_Empresa) REFERENCES Empresa (ID_Empresa) ON DELETE SET NULL
);

-- ==============================================================================
-- 5. ÍNDICES DE PERFORMANCE E ESPACIAIS (GIST E B-TREE)
-- ==============================================================================
CREATE INDEX idx_ponto_rede_geom ON Ponto_Rede USING GIST (Geometria_Espacial);
CREATE INDEX idx_trecho_rede_geom ON Trecho_Rede USING GIST (Geometria_Linha);
CREATE INDEX idx_trecho_rede_nodos ON Trecho_Rede (Origem_ID, Destino_ID);
CREATE INDEX idx_projeto_empresa ON Projeto (idEmpresa, Status);
CREATE INDEX idx_contem_projeto_status ON Contem (ID_Projeto, Status_Ponto);
CREATE INDEX idx_log_auditoria_usuario ON Log_Auditoria (ID_Usuario, Acao);
CREATE INDEX idx_log_auditoria_empresa_ts ON Log_Auditoria (ID_Empresa, Timestamp_UTC DESC);

CREATE TABLE IF NOT EXISTS Projeto_Participante
(
 ID_Projeto INT NOT NULL,
 ID_Usuario INT NOT NULL,
 Papel VARCHAR(30) NOT NULL CHECK (Papel IN ('Projetista', 'Visualizador')),
 Data_Inclusao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (ID_Projeto, ID_Usuario),
 FOREIGN KEY (ID_Projeto) REFERENCES Projeto (ID_Projeto) ON DELETE CASCADE,
 FOREIGN KEY (ID_Usuario) REFERENCES Usuario (ID_Usuario) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Convite
(
 ID_Convite SERIAL PRIMARY KEY,
 Tipo_Convite VARCHAR(20) NOT NULL CHECK (Tipo_Convite IN ('EMPRESA', 'PROJETO')),
 ID_Empresa INT NOT NULL,
 ID_Projeto INT NULL,
 ID_Usuario_Convidante INT NOT NULL,
 ID_Usuario_Convidado INT NOT NULL,
 Nivel_Acesso VARCHAR(30) NOT NULL CHECK (Nivel_Acesso IN ('Administrador', 'Projetista', 'Visualizador')),
 Status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE' CHECK (Status IN ('PENDENTE', 'ACEITO', 'RECUSADO', 'CANCELADO')),
 Mensagem TEXT NULL,
 Data_Criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 Data_Resposta TIMESTAMPTZ NULL,
 FOREIGN KEY (ID_Empresa) REFERENCES Empresa (ID_Empresa) ON DELETE CASCADE,
 FOREIGN KEY (ID_Projeto) REFERENCES Projeto (ID_Projeto) ON DELETE CASCADE,
 FOREIGN KEY (ID_Usuario_Convidante) REFERENCES Usuario (ID_Usuario) ON DELETE CASCADE,
 FOREIGN KEY (ID_Usuario_Convidado) REFERENCES Usuario (ID_Usuario) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_convite_convidado_status ON Convite (ID_Usuario_Convidado, Status);
CREATE INDEX IF NOT EXISTS idx_convite_empresa_status ON Convite (ID_Empresa, Status);

-- ==============================================================================
-- 6. VIEWS ANALÍTICAS E DE AUDITORIA (DQL)
-- ==============================================================================
CREATE OR REPLACE VIEW vw_resumo_projetos_corporativos AS
SELECT
    p.ID_Projeto,
    p.Nome AS Nome_Projeto,
    p.Status,
    p.idEmpresa AS ID_Empresa,
    p.Data_Criacao,
    e.Razao_Social AS Empresa,
    u.Nome AS Engenheiro_Responsavel,
    eng.CREA,
    p.Metragem_Total,
    p.Custo_Estimado,
    COUNT(DISTINCT CASE WHEN c.Status_Ponto = 'Ativo' THEN c.ID_Ponto END) AS Pontos_Ativos,
    COUNT(DISTINCT tr.ID_Trecho) AS Trechos_Otimizados
FROM Projeto p
INNER JOIN Empresa e ON e.ID_Empresa = p.idEmpresa
INNER JOIN Engenheiro eng ON eng.ID_Usuario = p.idEngenheiro
INNER JOIN Usuario u ON u.ID_Usuario = eng.ID_Usuario
LEFT JOIN Contem c ON c.ID_Projeto = p.ID_Projeto
LEFT JOIN Trecho_Rede tr ON tr.idProjeto = p.ID_Projeto
GROUP BY
    p.ID_Projeto,
    p.Nome,
    p.Status,
    p.idEmpresa,
    p.Data_Criacao,
    e.Razao_Social,
    u.Nome,
    eng.CREA,
    p.Metragem_Total,
    p.Custo_Estimado;

CREATE OR REPLACE VIEW vw_inventario_ativos_projeto AS
SELECT
    p.ID_Projeto,
    p.Nome AS Nome_Projeto,
    pr.ID_Ponto,
    pr.Descricao,
    ST_Y(pr.Geometria_Espacial) AS Latitude,
    ST_X(pr.Geometria_Espacial) AS Longitude,
    pr.Status_Fisico,
    c.Status_Ponto,
    COALESCE(te.Categoria::TEXT, 'Poste / Passivo') AS Categoria_Equipamento,
    COALESCE(te.Fabricante::TEXT, 'Não Especificado') AS Fabricante,
    COALESCE(te.Custo_Unitario, 0.00) AS Custo_Unitario
FROM Contem c
INNER JOIN Projeto p ON p.ID_Projeto = c.ID_Projeto
INNER JOIN Ponto_Rede pr ON pr.ID_Ponto = c.ID_Ponto
LEFT JOIN Tipo_Equipamento te ON te.ID_Tipo_Equipamento = pr.idTipo_Equipamento;

CREATE OR REPLACE VIEW vw_empresas_sem_projetos AS
SELECT
    e.ID_Empresa,
    e.CNPJ,
    e.Razao_Social
FROM Empresa e
LEFT JOIN Projeto p ON p.idEmpresa = e.ID_Empresa
WHERE p.ID_Projeto IS NULL;

-- ==============================================================================
-- 7. STORED FUNCTIONS (PL/pgSQL)
-- ==============================================================================
CREATE OR REPLACE FUNCTION fn_calcular_custo_trecho(
    p_distancia_metros NUMERIC,
    p_id_cabo INT
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_custo_metro NUMERIC(15,2);
BEGIN
    SELECT Custo_Por_Metro
      INTO v_custo_metro
      FROM Tipo_Cabo
     WHERE ID_Cabo = p_id_cabo;

    IF v_custo_metro IS NULL THEN
        RAISE EXCEPTION 'Tipo de cabo % não encontrado no catálogo.', p_id_cabo;
    END IF;

    RETURN ROUND(p_distancia_metros * v_custo_metro, 2);
END;
$$;

CREATE OR REPLACE FUNCTION fn_contar_pontos_ativos_projeto(
    p_id_projeto INT
)
RETURNS INT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_total INT;
BEGIN
    SELECT COUNT(*)::INT
      INTO v_total
      FROM Contem
     WHERE ID_Projeto = p_id_projeto
       AND Status_Ponto = 'Ativo';

    RETURN COALESCE(v_total, 0);
END;
$$;

-- ==============================================================================
-- 8. TRIGGERS DE INTEGRIDADE, IMUTABILIDADE E AUDITORIA (PL/pgSQL)
-- ==============================================================================
CREATE OR REPLACE FUNCTION fn_trg_validar_triangulo_projeto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM Vincula v
         WHERE v.ID_Usuario = NEW.idEngenheiro
           AND v.ID_Empresa = NEW.idEmpresa
    ) THEN
        RAISE EXCEPTION 'Violação de dependência triangular multi-tenant: engenheiro % sem vínculo com a empresa %.',
            NEW.idEngenheiro, NEW.idEmpresa;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_triangulo_projeto
BEFORE INSERT OR UPDATE ON Projeto
FOR EACH ROW
EXECUTE FUNCTION fn_trg_validar_triangulo_projeto();

CREATE OR REPLACE FUNCTION fn_trg_bloquear_edicao_projeto_concluido()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.Status IN ('Concluído', 'Cancelado') THEN
        RAISE EXCEPTION 'Imutabilidade histórica: projetos com status % não podem ser alterados.', OLD.Status;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bloquear_edicao_projeto_concluido
BEFORE UPDATE ON Projeto
FOR EACH ROW
EXECUTE FUNCTION fn_trg_bloquear_edicao_projeto_concluido();

CREATE OR REPLACE FUNCTION fn_trg_auditar_status_projeto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.Status IS DISTINCT FROM NEW.Status THEN
        INSERT INTO Log_Auditoria (Acao, ID_Usuario, Detalhes)
        VALUES (
            'PROJETO_STATUS_ALTERADO',
            NEW.idEngenheiro,
            format('Projeto #%s (%s) alterado de %s para %s.', NEW.ID_Projeto, NEW.Nome, OLD.Status, NEW.Status)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auditar_status_projeto
AFTER UPDATE ON Projeto
FOR EACH ROW
EXECUTE FUNCTION fn_trg_auditar_status_projeto();

-- ==============================================================================
-- 9. STORED PROCEDURES TRANSACIONAIS (PL/pgSQL)
-- ==============================================================================
CREATE OR REPLACE PROCEDURE sp_recalcular_resumo_projeto(
    p_id_projeto INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_metragem NUMERIC(15,2);
    v_custo_cabos NUMERIC(15,2);
    v_custo_equipamentos NUMERIC(15,2);
BEGIN
    SELECT COALESCE(SUM(Distancia_Metros), 0.00),
           COALESCE(SUM(Custo_Trecho), 0.00)
      INTO v_metragem, v_custo_cabos
      FROM Trecho_Rede
     WHERE idProjeto = p_id_projeto;

    SELECT COALESCE(SUM(te.Custo_Unitario), 0.00)
      INTO v_custo_equipamentos
      FROM Contem c
      INNER JOIN Ponto_Rede pr ON pr.ID_Ponto = c.ID_Ponto
      LEFT JOIN Tipo_Equipamento te ON te.ID_Tipo_Equipamento = pr.idTipo_Equipamento
     WHERE c.ID_Projeto = p_id_projeto
       AND c.Status_Ponto = 'Ativo';

    UPDATE Projeto
       SET Metragem_Total = v_metragem,
           Custo_Estimado = v_custo_cabos + v_custo_equipamentos
     WHERE ID_Projeto = p_id_projeto;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_aplicar_soft_delete_ponto(
    p_id_projeto INT,
    p_id_ponto INT,
    p_novo_status enum_status_ponto
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_novo_status IN ('Inativo', 'Removido') AND EXISTS (
        SELECT 1
          FROM Trecho_Rede tr
         WHERE tr.idProjeto = p_id_projeto
           AND (tr.Origem_ID = p_id_ponto OR tr.Destino_ID = p_id_ponto)
    ) THEN
        RAISE EXCEPTION 'ON DELETE RESTRICT topológico: o ponto % possui trechos ativos no projeto %.',
            p_id_ponto, p_id_projeto;
    END IF;

    UPDATE Contem
       SET Status_Ponto = p_novo_status
     WHERE ID_Projeto = p_id_projeto
       AND ID_Ponto = p_id_ponto;

    CALL sp_recalcular_resumo_projeto(p_id_projeto);
END;
$$;

-- ==============================================================================
-- 10. DCL — CONTROLE DE ACESSO E PAPÉIS (POSTGRESQL RBAC — REFERÊNCIA PARA DBA)
-- ==============================================================================
-- CREATE ROLE role_infraroute_leitura;
-- CREATE ROLE role_infraroute_projetista;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO role_infraroute_leitura;
-- GRANT SELECT, INSERT, UPDATE ON Projeto, Ponto_Rede, Contem, Trecho_Rede TO role_infraroute_projetista;
-- REVOKE DELETE ON Ponto_Rede FROM role_infraroute_projetista;
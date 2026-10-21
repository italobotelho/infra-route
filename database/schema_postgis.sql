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
CREATE TYPE enum_nivel_acesso AS ENUM ('Administrador', 'Projetista', 'Visualizador');

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
 Senha VARCHAR(255) NOT NULL
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
 Distancia_Metros NUMERIC(15,2) NOT NULL CHECK (Distancia_Metros > 0),
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

-- ==============================================================================
-- 5. ÍNDICES DE PERFORMANCE E ESPACIAIS (GIST)
-- ==============================================================================
CREATE INDEX idx_ponto_rede_geom ON Ponto_Rede USING GIST (Geometria_Espacial);
CREATE INDEX idx_trecho_rede_geom ON Trecho_Rede USING GIST (Geometria_Linha);
CREATE INDEX idx_trecho_rede_nodos ON Trecho_Rede (Origem_ID, Destino_ID);
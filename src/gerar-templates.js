const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, AlignmentType } = require('docx');

// DEFINA AQUI O CAMINHO DA SUA PASTA DE TEMPLATES (ex: './templates' ou './src/templates')
const PASTA_TEMPLATES = './templates'; 

// Garante que a pasta existe
if (!fs.existsSync(PASTA_TEMPLATES)){
    fs.mkdirSync(PASTA_TEMPLATES, { recursive: true });
}

async function criarDocumentoWord(nomeArquivo, titulo, paragrafos) {
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                // Título Centralizado e Negrito
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: titulo, bold: true, size: 28, font: "Arial" })],
                    spacing: { after: 400 }
                }),
                // Corpo do Texto
                ...paragrafos.map(texto => new Paragraph({
                    alignment: AlignmentType.JUSTIFY,
                    children: [new TextRun({ text: texto, size: 24, font: "Arial" })],
                    spacing: { after: 240, line: 360 } // Espaçamento 1,5
                }))
            ],
        }],
    });

    const buffer = await Packer.toBuffer(doc);
    const caminhoCompleto = path.join(PASTA_TEMPLATES, `${nomeArquivo}.docx`);
    fs.writeFileSync(caminhoCompleto, buffer);
    console.log(`✅ Arquivo criado com sucesso: ${caminhoCompleto}`);
}

const contratos = [
    {
        arquivo: 'procuracao',
        titulo: 'PROCURAÇÃO AD JUDICIA ET EXTRA',
        texto: [
            'OUTORGANTE: {{NOME_COMPLETO}}, {{ESTADO_CIVIL}}, {{PROFISSAO}}, inscrito(a) no CPF sob o nº {{CPF}} e RG nº {{RG}}, residente e domiciliado(a) na {{ENDERECO_COMPLETO}}, telefone {{TELEFONE}}, e-mail {{E-MAIL}}.',
            'OUTORGADO(A): [Nome do Advogado ou Escritório], inscrito(a) na OAB sob o nº [Número], com escritório profissional na [Endereço do Escritório].',
            'PODERES: Pelo presente instrumento particular de procuração, o(a) OUTORGANTE nomeia e constitui seu(sua) bastante procurador(a) o(a) advogado(a) acima qualificado(a), a quem confere os poderes da cláusula "ad judicia et extra", para o foro em geral, em qualquer Juízo, Instância ou Tribunal, podendo propor contra quem de direito as ações competentes e defendê-lo(a) nas contrárias, seguindo umas e outras até final decisão, usando os recursos legais e acompanhando-os.',
            'Confere ainda os poderes especiais para receber citação, confessar, reconhecer a procedência do pedido, transigir, desistir, renunciar ao direito sobre o qual se funda a ação, receber e dar quitação, firmar compromisso, prestar declarações, assinar termos e requerimentos, bem como substabelecer esta a outrem, com ou sem reserva de iguais poderes, para o fiel cumprimento do presente mandato.',
            '{{CIDADE_CLIENTE}}, [Data atual].',
            '\n\n____________________________________\n{{NOME_COMPLETO}} (OUTORGANTE)'
        ]
    },
    {
        arquivo: 'contrato_honorarios',
        titulo: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS JURÍDICOS E HONORÁRIOS ADVOCATÍCIOS',
        texto: [
            'CONTRATANTE: {{NOME_COMPLETO}}, {{ESTADO_CIVIL}}, {{PROFISSAO}}, inscrito(a) no CPF sob o nº {{CPF}} e RG nº {{RG}}, residente e domiciliado(a) na {{ENDERECO_COMPLETO}}, telefone {{TELEFONE}}, e-mail {{E-MAIL}}.',
            'CONTRATADO: [Nome do Advogado ou Escritório], inscrito(a) na OAB sob o nº [Número], com escritório profissional na [Endereço do Escritório].',
            'CLÁUSULA PRIMEIRA – DO OBJETO: O presente contrato tem como objeto a prestação de serviços jurídicos para ajuizamento e acompanhamento de Ação Judicial em face de [Nome do Réu], visando a defesa dos interesses do(a) CONTRATANTE.',
            'CLÁUSULA SEGUNDA – DOS HONORÁRIOS (AD EXITUM): Como contraprestação pelos serviços advocatícios ora contratados, o(a) CONTRATANTE pagará ao CONTRATADO o percentual de 10% (dez por cento) incidente sobre o valor total do proveito econômico obtido na demanda (seja por sentença, liquidação, execução ou acordo extrajudicial/judicial).',
            'Parágrafo único: O pagamento dos honorários ora estipulados dar-se-á exclusivamente no êxito da demanda (Ad Exitum), no momento do levantamento dos valores.',
            'CLÁUSULA TERCEIRA – DAS DESPESAS: Todas as despesas judiciais ou extrajudiciais correrão por conta exclusiva do(a) CONTRATANTE, mediante prévia comprovação pelo CONTRATADO.',
            'CLÁUSULA QUARTA – DO FORO: Fica eleito o foro da comarca de {{CIDADE_CLIENTE}} para dirimir quaisquer dúvidas ou litígios oriundos deste contrato.',
            '[Cidade - UF], [Data atual].',
            '\n\n____________________________________\n{{NOME_COMPLETO}} (CONTRATANTE)',
            '\n\n____________________________________\n[Nome do Advogado] (CONTRATADO)'
        ]
    },
    {
        arquivo: 'declaracao_hipossuficiencia',
        titulo: 'DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA',
        texto: [
            'Eu, {{NOME_COMPLETO}}, {{ESTADO_CIVIL}}, {{PROFISSAO}}, inscrito(a) no CPF sob o nº {{CPF}} e RG nº {{RG}}, residente e domiciliado(a) na {{ENDERECO_COMPLETO}}, declaro para os devidos fins de direito e sob as penas da lei, com fulcro no artigo 98 e seguintes do Código de Processo Civil (Lei nº 13.105/2015) e no artigo 5º, inciso LXXIV da Constituição Federal, que não possuo condições financeiras para arcar com o pagamento de custas processuais e honorários advocatícios sem prejuízo do meu próprio sustento e de minha família.',
            'Por ser a expressão da verdade, assumindo total responsabilidade civil e criminal por esta declaração, firmo o presente instrumento.',
            '[Cidade - UF], [Data atual].',
            '\n\n____________________________________\n{{NOME_COMPLETO}}'
        ]
    },
    {
        arquivo: 'termo_fatos',
        titulo: 'FICHA DE ENTREVISTA E TERMO DE DECLARAÇÃO DE FATOS',
        texto: [
            '1. DADOS DO CLIENTE\nNome: {{NOME_COMPLETO}}\nCPF: {{CPF}} | RG: {{RG}} | Data de Nascimento: {{DATA_DE_NASCIMENTO}}\nProfissão: {{PROFISSAO}} | Estado Civil: {{CASADO(A)}}\nEndereço: {{ENDERECO_COMPLETO}}\nTelefone: {{TELEFONE}} | E-mail: {{E-MAIL}}',
            '2. RELATO DOS FATOS (Ficha preenchida pelo Advogado)\nO(A) cliente declara que: [Inserir resumo dos fatos relatados pelo cliente].',
            '3. DOCUMENTOS ENTREGUES NESTA DATA\nO(A) cliente realizou a entrega dos seguintes documentos digitais/físicos:\n( ) Cópia do RG e CPF\n( ) Cópia do Comprovante de Residência\n( ) Outros: __________________________________________________',
            'O(A) CONTRATANTE declara expressamente que todas as informações prestadas e relatos descritos neste termo correspondem estritamente à verdade, assumindo inteira responsabilidade pela veracidade e pela autenticidade dos documentos entregues.',
            '[Cidade - UF], [Data atual].',
            '\n\n____________________________________\n{{NOME_COMPLETO}}'
        ]
    }
];

async function executar() {
    for (const doc of contratos) {
        await criarDocumentoWord(doc.arquivo, doc.titulo, doc.texto);
    }
}

executar();
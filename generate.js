require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./database');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function gerarDevocional(data, tipo = 'geral') {
  const dataObj = data ? new Date(data + 'T12:00:00') : new Date();
  const dataStr = dataObj.toISOString().split('T')[0];
  const tabela  = tipo === 'hfc' ? 'devocionais_hfc' : 'devocionais';

  // Verifica se já existe
  const existente = db.prepare(`SELECT * FROM ${tabela} WHERE data = ?`).get(dataStr);
  if (existente) {
    console.log(`Devocional ${tipo} para ${dataStr} já existe.`);
    return existente;
  }

  console.log(`Gerando devocional ${tipo} para ${dataStr}...`);

  const contextoHFC = tipo === 'hfc'
    ? 'Este devocional é especificamente para o grupo HFC (Homens Fortes e Corajosos) — homens cristãos buscando ser líderes piedosos em suas famílias e comunidades. Aborde temas como paternidade, liderança servil, integridade, coragem e fé masculina.'
    : 'Este devocional é para todos os membros da igreja.';

  const prompt = `Você é um pastor evangélico brasileiro criando um devocional diário. ${contextoHFC}

Gere um devocional completo para hoje (${dataStr}) com:
1. Um versículo bíblico (preferencialmente do Novo Testamento ou Salmos)
2. Uma reflexão curta e profunda (3-4 frases)
3. Uma prática/aplicação para o dia (1-2 frases, algo concreto e simples)
4. Um tema principal (2-3 palavras)

Responda APENAS com JSON válido neste formato exato:
{
  "versiculo_referencia": "Livro capítulo:versículo",
  "versiculo_texto": "Texto completo do versículo na versão NVI ou ARC",
  "reflexao": "Texto da reflexão...",
  "pratica": "Texto da prática...",
  "tema": "Tema do dia"
}

Importante:
- Use linguagem simples e acessível
- A reflexão deve ser edificante e aplicável ao cotidiano
- A prática deve ser algo que qualquer pessoa possa fazer hoje
- Varie os livros bíblicos ao longo dos dias`;

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent(prompt);
  const content = result.response.text().trim();

  // Extrai o JSON da resposta
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Resposta inválida da API: ' + content);
  }

  const devocional = JSON.parse(jsonMatch[0]);

  // Salva no banco
  db.prepare(`
    INSERT OR REPLACE INTO ${tabela} (data, versiculo_referencia, versiculo_texto, reflexao, pratica, tema)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(dataStr, devocional.versiculo_referencia, devocional.versiculo_texto, devocional.reflexao, devocional.pratica, devocional.tema);

  console.log(`Devocional gerado com sucesso para ${dataStr}:`, devocional.versiculo_referencia);
  return devocional;
}

// Executar se chamado diretamente
if (require.main === module) {
  const data = process.argv[2]; // opcional: node generate.js 2026-04-16
  const tipo = process.argv[3] || 'geral'; // opcional: node generate.js 2026-04-16 hfc
  gerarDevocional(data, tipo)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Erro ao gerar devocional:', err);
      process.exit(1);
    });
}

module.exports = { gerarDevocional };

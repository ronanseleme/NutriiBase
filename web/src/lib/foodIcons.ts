// Ícone (emoji) pra cada alimento, baseado em palavras-chave no nome —
// cobre a base NutriiBase e a maioria do que a IA costuma devolver. A
// ordem importa: entradas mais específicas vêm antes de termos genéricos
// (ex: "leite condensado" antes de "leite") pra não perder pro match errado.
const RULES: { icon: string; keywords: string[] }[] = [
  { icon: '🍎', keywords: ['maca', 'maçã'] },
  { icon: '🍌', keywords: ['banana'] },
  { icon: '🍊', keywords: ['laranja', 'tangerina', 'mexerica'] },
  { icon: '🍇', keywords: ['uva'] },
  { icon: '🍓', keywords: ['morango'] },
  { icon: '🍍', keywords: ['abacaxi'] },
  { icon: '🍉', keywords: ['melancia'] },
  { icon: '🥭', keywords: ['manga'] },
  { icon: '🍐', keywords: ['pera', 'pêra'] },
  { icon: '🥝', keywords: ['kiwi'] },
  { icon: '🥥', keywords: ['coco'] },
  { icon: '🥑', keywords: ['abacate'] },
  { icon: '🍑', keywords: ['pessego', 'pêssego', 'ameixa'] },
  { icon: '🫐', keywords: ['mirtilo', 'blueberry'] },
  { icon: '🍈', keywords: ['mamao', 'mamão', 'melao', 'melão'] },
  { icon: '🍒', keywords: ['cereja'] },
  { icon: '🍋', keywords: ['limao', 'limão'] },
  { icon: '🍅', keywords: ['tomate'] },
  { icon: '🥕', keywords: ['cenoura'] },
  { icon: '🥦', keywords: ['brocolis', 'brócolis', 'couve-flor', 'couve flor'] },
  { icon: '🥬', keywords: ['couve', 'alface', 'rucula', 'rúcula', 'repolho', 'espinafre'] },
  { icon: '🥒', keywords: ['pepino', 'abobrinha'] },
  { icon: '🌽', keywords: ['milho'] },
  { icon: '🫑', keywords: ['pimentao', 'pimentão'] },
  { icon: '🧅', keywords: ['cebola'] },
  { icon: '🧄', keywords: ['alho'] },
  { icon: '🍠', keywords: ['batata doce', 'mandioca', 'aipim', 'macaxeira'] },
  { icon: '🥔', keywords: ['batata'] },
  { icon: '🍚', keywords: ['arroz'] },
  { icon: '🍞', keywords: ['pao', 'pão', 'torrada'] },
  { icon: '🥐', keywords: ['croissant'] },
  { icon: '🍝', keywords: ['macarrao', 'macarrão', 'massa', 'lasanha', 'espaguete'] },
  { icon: '🥣', keywords: ['aveia', 'granola', 'cereal', 'cuscuz', 'polenta'] },
  { icon: '🫓', keywords: ['tapioca', 'panqueca'] },
  { icon: '🫘', keywords: ['feijao', 'feijão', 'lentilha', 'grao de bico', 'grão de bico'] },
  { icon: '🍕', keywords: ['pizza'] },
  { icon: '🍟', keywords: ['batata frita'] },
  { icon: '🍔', keywords: ['hamburguer', 'hambúrguer'] },
  { icon: '🌭', keywords: ['cachorro quente', 'salsicha', 'linguica', 'linguiça'] },
  { icon: '🥓', keywords: ['bacon'] },
  { icon: '🍗', keywords: ['frango', 'peru', 'aves'] },
  { icon: '🥩', keywords: ['carne', 'bife', 'bovina', 'suina', 'suína', 'porco', 'lombo', 'costela', 'picanha', 'file', 'filé'] },
  { icon: '🐟', keywords: ['peixe', 'tilapia', 'tilápia', 'salmao', 'salmão', 'atum', 'sardinha', 'bacalhau'] },
  { icon: '🦐', keywords: ['camarao', 'camarão', 'frutos do mar'] },
  { icon: '🥚', keywords: ['ovo', 'clara de ovo'] },
  { icon: '🧀', keywords: ['queijo'] },
  { icon: '🥛', keywords: ['leite'] },
  { icon: '🥄', keywords: ['iogurte', 'whey', 'proteina', 'proteína', 'albumina'] },
  { icon: '🧈', keywords: ['manteiga', 'requeijao', 'requeijão', 'cream cheese'] },
  { icon: '🫒', keywords: ['azeite', 'oliva'] },
  { icon: '🥜', keywords: ['amendoim', 'castanha', 'nozes', 'amendoa', 'amêndoa'] },
  { icon: '🍯', keywords: ['mel'] },
  { icon: '🍫', keywords: ['chocolate', 'brigadeiro'] },
  { icon: '🍰', keywords: ['bolo', 'torta'] },
  { icon: '🍩', keywords: ['rosquinha', 'donut'] },
  { icon: '🍪', keywords: ['biscoito', 'cookie', 'paçoca', 'pacoca'] },
  { icon: '🍦', keywords: ['sorvete', 'picole', 'picolé'] },
  { icon: '🍮', keywords: ['pudim', 'doce de leite'] },
  { icon: '🍿', keywords: ['pipoca'] },
  { icon: '☕', keywords: ['cafe', 'café'] },
  { icon: '🧃', keywords: ['suco', 'vitamina'] },
  { icon: '🥤', keywords: ['refrigerante', 'isotonico', 'isotônico', 'energetico', 'energético'] },
  { icon: '🍺', keywords: ['cerveja'] },
  { icon: '💧', keywords: ['agua', 'água'] },
  { icon: '🥗', keywords: ['salada'] },
  { icon: '🍲', keywords: ['sopa', 'caldo', 'feijoada', 'moqueca', 'strogonoff', 'estrogonofe'] },
  { icon: '🥟', keywords: ['coxinha', 'pastel', 'esfirra', 'empada', 'salgado'] },
  { icon: '🥪', keywords: ['sanduiche', 'sanduíche', 'misto quente'] },
  { icon: '🫙', keywords: ['ketchup', 'maionese', 'mostarda', 'molho', 'shoyu', 'tempero'] },
  { icon: '🍬', keywords: ['acucar', 'açúcar', 'goiabada'] },
  { icon: '🌾', keywords: ['quinoa', 'farinha', 'farofa'] },
]

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function foodIcon(name: string): string {
  const n = normalize(name)
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => n.includes(normalize(kw)))) return rule.icon
  }
  return '🍽️'
}

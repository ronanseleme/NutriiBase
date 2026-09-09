# NutriiBase

Controle real da sua alimentação e do seu gasto energético.

O NutriiBase é um aplicativo pessoal de controle nutricional e esportivo que dá ao usuário visibilidade completa sobre o que ele consome e o que ele gasta, todos os dias, com números reais — não estimativas genéricas de dieta.

## O problema que resolve

A maioria das pessoas tenta emagrecer, manter ou ganhar massa sem saber, de fato, quantas calorias consome por dia, quantos macronutrientes (proteína, carboidrato, gordura) ingere, nem quanto gasta com atividade física. Sem esses números, é impossível saber com precisão se está em **déficit ou superávit calórico** — a variável que mais determina o resultado de qualquer objetivo físico.

## O que o NutriiBase entrega

- Meta calórica diária personalizada (TMB/GET), calculada a partir de idade, sexo, peso, altura, % de gordura corporal, nível de atividade e objetivo (emagrecimento, manutenção ou ganho de massa).
- Registro diário de refeições com macros por alimento — busca em base de dados, entrada manual, ou descrição em linguagem natural interpretada por IA.
- Registro de treinos com estimativa de gasto calórico por tipo, intensidade e duração.
- **Saldo calórico do dia em tempo real**: consumo vs. meta ajustada pelo gasto com exercício — mostrando na hora se o usuário está em déficit ou superávit.
- Acompanhamento de peso e percentual de gordura ao longo do tempo, comparado com a meta traçada.
- Dados 100% pessoais e privados — cada usuário autentica e só acessa os próprios dados.

## Para quem é

Qualquer pessoa que queira sair do "achismo" na dieta: quem treina, quer emagrecer, ganhar massa, ou simplesmente entender os próprios hábitos alimentares com dados reais — sem planilha complicada nem app genérico cheio de anúncio.

## Em uma frase

O NutriiBase transforma "acho que estou comendo bem" em "sei exatamente quantas calorias como, gasto e preciso hoje" — devolvendo ao usuário o controle real da própria alimentação.

## Stack

- **Produção (`main`)**: HTML/CSS/JS puro, hospedado no GitHub Pages.
- **Em construção (`react-rewrite`)**: React + TypeScript + Vite + Tailwind, preview em [nutrii-base.vercel.app](https://nutrii-base.vercel.app).
- **Backend**: Supabase (autenticação, banco de dados com Row Level Security, Edge Function para a IA de interpretação de refeições).

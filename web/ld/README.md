# NutriiBase — Landing Page Oficial

Landing page de alta conversão, responsiva e performática do **NutriiBase**, plataforma de controle calórico e macronutrientes auxiliada por Inteligência Artificial para a culinária e rotina brasileira.

---

## 📁 Estrutura de Arquivos

```text
├── index.html              # Landing page principal (Hero, Demonstração interativa, Planos, Prova social, FAQ)
├── privacidade.html        # Política de Privacidade completa em conformidade com a LGPD
├── termos.html             # Termos de Uso (regras de assinatura, teste de 5 dias e aviso de saúde)
├── suporte.html            # Central de Ajuda (FAQ interativo, WhatsApp e envio de e-mail para nutriibase@gmail.com)
├── public/                 # Imagens e ativos estáticos (Logo Branca SF.png, favicon, banners)
├── vite.config.ts          # Configuração de build multi-páginas do Vite
├── package.json            # Dependências e scripts de desenvolvimento e compilação
└── tsconfig.json           # Configurações TypeScript
```

---

## 🔗 Fluxo de Conversão e Integração de Pagamento

Os botões de conversão foram preparados para se conectar com a sua aplicação principal e o gateway do Stripe:

1. **Cadastro Gratuito**:
   - Aponta para `https://nutriibase.com.br/cadastro`
2. **Assinatura Pro (Trial de 5 dias)**:
   - Aponta para `https://nutriibase.com.br/checkout?plano=[periodo]`
   - O parâmetro do plano é atualizado em tempo real conforme o usuário clica nos seletores de período (**Mensal**, **Trimestral**, **Semestral** ou **Anual**):
     - Mensal: `https://nutriibase.com.br/checkout?plano=mensal`
     - Trimestral: `https://nutriibase.com.br/checkout?plano=trimestral`
     - Semestral: `https://nutriibase.com.br/checkout?plano=semestral`
     - Anual: `https://nutriibase.com.br/checkout?plano=anual`

> **Dica de Integração:** No seu sistema principal, na rota `/checkout`, basta ler o query param `?plano=...` para selecionar a respectiva Session do Stripe Checkout ou criar a assinatura com o ID de produto configurado.

---

## 🚀 Como Executar Localmente

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento local
npm run dev

# 3. Gerar build estático otimizado para produção
npm run build
```

Os arquivos prontos para publicação estarão gerados na pasta `dist/`.

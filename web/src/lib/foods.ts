export interface FoodDbEntry {
  name: string
  kcal: number
  p: number
  c: number
  f: number
  hint?: string
}

export const FOODS: FoodDbEntry[] = [
  { name: 'Arroz branco cozido', kcal: 128, p: 2.5, c: 28, f: 0.2 },
  { name: 'Arroz integral cozido', kcal: 123, p: 2.6, c: 25.8, f: 1 },
  { name: 'Feijão carioca cozido', kcal: 76, p: 4.8, c: 13.6, f: 0.5 },
  { name: 'Feijão preto cozido', kcal: 77, p: 4.5, c: 14, f: 0.5 },
  { name: 'Lentilha cozida', kcal: 116, p: 9, c: 20, f: 0.4 },
  { name: 'Grão de bico cozido', kcal: 164, p: 8.9, c: 27, f: 2.6 },
  { name: 'Quinoa cozida', kcal: 120, p: 4.4, c: 21, f: 1.9 },
  { name: 'Macarrão cozido', kcal: 158, p: 5.8, c: 31, f: 0.9 },
  { name: 'Pão francês', kcal: 300, p: 8, c: 58, f: 3, hint: '1 unidade ≈ 50 g' },
  { name: 'Pão integral', kcal: 247, p: 13, c: 41, f: 3.4, hint: '1 fatia ≈ 25 g' },
  { name: 'Aveia em flocos', kcal: 389, p: 16.9, c: 66, f: 6.9 },
  { name: 'Granola', kcal: 471, p: 10, c: 64, f: 20 },
  { name: 'Tapioca (goma)', kcal: 240, p: 0.2, c: 59, f: 0.1 },
  { name: 'Peito de frango grelhado', kcal: 165, p: 31, c: 0, f: 3.6 },
  { name: 'Carne bovina moída cozida', kcal: 250, p: 26, c: 0, f: 15 },
  { name: 'Carne bovina (patinho) grelhada', kcal: 219, p: 32, c: 0, f: 9.5 },
  { name: 'Tilápia grelhada', kcal: 128, p: 26, c: 0, f: 2.7 },
  { name: 'Salmão grelhado', kcal: 208, p: 20, c: 0, f: 13 },
  { name: 'Atum em lata (água)', kcal: 116, p: 26, c: 0, f: 1 },
  { name: 'Tofu', kcal: 76, p: 8, c: 1.9, f: 4.8 },
  { name: 'Ovo cozido', kcal: 155, p: 13, c: 1.1, f: 11, hint: '1 unidade ≈ 50 g' },
  { name: 'Queijo minas frescal', kcal: 264, p: 17, c: 3, f: 20 },
  { name: 'Queijo mussarela', kcal: 280, p: 22, c: 2.2, f: 21 },
  { name: 'Leite integral', kcal: 61, p: 3.2, c: 4.8, f: 3.3 },
  { name: 'Leite desnatado', kcal: 35, p: 3.4, c: 5, f: 0.2 },
  { name: 'Iogurte natural', kcal: 61, p: 3.5, c: 4.7, f: 3.3 },
  { name: 'Iogurte grego', kcal: 97, p: 9, c: 3.6, f: 5 },
  { name: 'Whey protein (pó)', kcal: 400, p: 80, c: 10, f: 3 },
  { name: 'Banana', kcal: 89, p: 1.1, c: 23, f: 0.3, hint: '1 unidade média ≈ 120 g' },
  { name: 'Maçã', kcal: 52, p: 0.3, c: 14, f: 0.2, hint: '1 unidade média ≈ 130 g' },
  { name: 'Laranja', kcal: 47, p: 0.9, c: 12, f: 0.1, hint: '1 unidade média ≈ 180 g' },
  { name: 'Mamão', kcal: 43, p: 0.5, c: 11, f: 0.1 },
  { name: 'Abacaxi', kcal: 50, p: 0.5, c: 13, f: 0.1 },
  { name: 'Morango', kcal: 32, p: 0.7, c: 7.7, f: 0.3 },
  { name: 'Uva', kcal: 69, p: 0.7, c: 18, f: 0.2 },
  { name: 'Melancia', kcal: 30, p: 0.6, c: 7.6, f: 0.2 },
  { name: 'Abacate', kcal: 160, p: 2, c: 8.5, f: 15 },
  { name: 'Batata inglesa cozida', kcal: 87, p: 1.9, c: 20, f: 0.1 },
  { name: 'Batata doce cozida', kcal: 86, p: 1.6, c: 20, f: 0.1, hint: '1 unidade ≈ 150 g' },
  { name: 'Mandioca cozida', kcal: 125, p: 0.6, c: 30, f: 0.3 },
  { name: 'Brócolis cozido', kcal: 35, p: 2.4, c: 7, f: 0.4 },
  { name: 'Espinafre cru', kcal: 23, p: 2.9, c: 3.6, f: 0.4 },
  { name: 'Cenoura', kcal: 41, p: 0.9, c: 10, f: 0.2 },
  { name: 'Tomate', kcal: 18, p: 0.9, c: 3.9, f: 0.2 },
  { name: 'Alface', kcal: 15, p: 1.4, c: 2.9, f: 0.2 },
  { name: 'Pepino', kcal: 15, p: 0.7, c: 3.6, f: 0.1 },
  { name: 'Azeite de oliva', kcal: 884, p: 0, c: 0, f: 100 },
  { name: 'Manteiga', kcal: 717, p: 0.9, c: 0.1, f: 81 },
  { name: 'Amendoim', kcal: 567, p: 26, c: 16, f: 49 },
  { name: 'Castanha do Pará', kcal: 656, p: 14, c: 12, f: 66 },
  { name: 'Castanha de caju', kcal: 553, p: 18, c: 30, f: 44 },
  { name: 'Mel', kcal: 304, p: 0.3, c: 82, f: 0 },
  { name: 'Açúcar refinado', kcal: 387, p: 0, c: 100, f: 0 },
  { name: 'Chocolate amargo 70%', kcal: 598, p: 7.8, c: 45, f: 42 },
  { name: 'Pipoca sem óleo', kcal: 387, p: 13, c: 78, f: 4.5 },
  { name: 'Batata frita industrial', kcal: 312, p: 3.4, c: 41, f: 15 },
  { name: 'Pizza mussarela (fatia)', kcal: 266, p: 11, c: 33, f: 10, hint: '1 fatia ≈ 100 g' },
  { name: 'Hambúrguer artesanal', kcal: 295, p: 17, c: 24, f: 14 },
  { name: 'Refrigerante', kcal: 42, p: 0, c: 10.6, f: 0 },
  { name: 'Suco de laranja natural', kcal: 45, p: 0.7, c: 10, f: 0.2 },
  { name: 'Água de coco', kcal: 19, p: 0.7, c: 3.7, f: 0.2 },
  { name: 'Cerveja', kcal: 43, p: 0.5, c: 3.6, f: 0 },
  { name: 'Café sem açúcar', kcal: 2, p: 0.3, c: 0, f: 0 },
]

export function scaledFood(base: FoodDbEntry, grams: number) {
  const s = grams / 100
  return {
    kcal: Math.round(base.kcal * s),
    protein: Math.round(base.p * s),
    carbs: Math.round(base.c * s),
    fat: Math.round(base.f * s),
  }
}

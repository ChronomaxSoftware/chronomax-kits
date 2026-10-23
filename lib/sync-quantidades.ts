/**
 * Regra do sync do Gestão para quantidades que o usuário também edita no sistema
 * (card "Produtos" e o campo "Celulares" do evento).
 *
 * Guardamos o último valor que veio do Gestão. Se o valor atual ainda é igual a ele,
 * o usuário não mexeu → segue o Gestão. Se é diferente, o usuário alterou → o sync
 * não mexe, a não ser que o Gestão AUMENTE o pedido; aí vale o maior dos dois.
 */
export function quantidadeAposSync(atual: number, gestaoAnterior: number | null, gestaoNovo: number): number {
  // Sem histórico (antes desta regra existir): não dá pra saber se foi editado → nunca diminui.
  if (gestaoAnterior === null) return Math.max(atual, gestaoNovo);
  if (atual === gestaoAnterior) return gestaoNovo;
  if (gestaoNovo > gestaoAnterior) return Math.max(atual, gestaoNovo);
  return atual;
}

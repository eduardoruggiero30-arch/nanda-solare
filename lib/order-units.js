// Contagem de luminárias de um pedido: kit + order bump + upsells/downsells.
// Upsells são gravados como pedidos separados (customer_address.upsell_of = id
// do pedido principal) e copiam o customer_address do principal — inclusive
// orderBumps —, então o bump só é contado no pedido principal.

// Unidades do order bump "Leve +N" (ver BUMP_CONFIG no checkout.html)
const BUMP_UNITS = { led: 3 };
const DEFAULT_BUMP_UNITS = 2;

// Limite de ids por filtro .in() para não estourar o tamanho da URL
const IN_CHUNK = 100;

export function parseAddress(addr) {
  if (!addr) return {};
  if (typeof addr !== 'string') return addr;
  try { return JSON.parse(addr); } catch { return {}; }
}

// Busca os upsells (de qualquer status) ligados aos pedidos principais da lista
export async function fetchUpsells(supabase, orders) {
  const ids = orders
    .filter(o => !parseAddress(o.customer_address).upsell)
    .map(o => o.id);

  const upsells = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, status, product_quantity, customer_address')
      .in('customer_address->>upsell_of', ids.slice(i, i + IN_CHUNK));
    if (error) throw error;
    upsells.push(...data);
  }
  return upsells;
}

// { kit, bump, upsell, upsellPending, total, upsellOf }
// total = luminárias a enviar: kit + bump + upsells aprovados.
export function orderUnits(order, upsells = []) {
  const a = parseAddress(order.customer_address);
  const kit = Number(order.product_quantity) || 0;

  if (a.upsell) {
    return {
      kit, bump: 0, upsell: 0, upsellPending: 0, total: kit,
      upsellOf: a.upsell_of || null,
      upsellApproved: order.status === 'approved',
    };
  }

  const bump = a.orderBumps?.luminaria ? (BUMP_UNITS[a.productType] ?? DEFAULT_BUMP_UNITS) : 0;

  const mine = upsells.filter(u => parseAddress(u.customer_address).upsell_of === order.id);
  const sumQty = list => list.reduce((s, u) => s + (Number(u.product_quantity) || 0), 0);
  const upsell = sumQty(mine.filter(u => u.status === 'approved'));
  const upsellPending = sumQty(mine.filter(u => u.status === 'pending'));

  return { kit, bump, upsell, upsellPending, total: kit + bump + upsell, upsellOf: null };
}

// "2 kit + 2 bump + 2 upsell" (vazio quando é só o kit)
export function unitsDetail(u) {
  if (u.upsellOf) {
    return u.upsellApproved
      ? 'Upsell: já somado no pedido principal'
      : 'Upsell não pago: não somado';
  }
  const parts = [];
  if (u.bump || u.upsell) {
    parts.push(`${u.kit} kit`);
    if (u.bump)   parts.push(`${u.bump} bump`);
    if (u.upsell) parts.push(`${u.upsell} upsell`);
  }
  let txt = parts.join(' + ');
  if (u.upsellPending) txt += `${txt ? ' · ' : ''}+${u.upsellPending} upsell pendente`;
  return txt;
}

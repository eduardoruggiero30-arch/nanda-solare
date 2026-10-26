// Dados que o Mercado Pago avalia em "Qualidade da integração": itens com
// descrição, categoria e imagem; comprador completo (telefone, endereço);
// endereço de entrega; nome na fatura; IP do comprador.

export const STATEMENT_DESCRIPTOR = 'NANDA SOLARE';

const SITE = 'https://www.nandasolare.com.br';

export const MP_PRODUCTS = {
  solar: {
    id: 'nanda-luminaria-solar-parede',
    title: 'Luminária Solar de Parede LED',
    description: 'Luminária solar de parede com LED, luz para cima e para baixo. Carrega pelo painel solar e acende sozinha ao anoitecer, sem fio e sem conta de luz. Proteção IP65 contra chuva, bateria Ni-MH 600 mAh, corpo em ABS.',
    picture_url: `${SITE}/luminaria-capa.jpg`,
  },
  jardim: {
    id: 'nanda-luminaria-solar-jardim',
    title: 'Luminária Solar de Jardim (Espeto)',
    description: 'Luminária solar de espeto para jardim, 55 cm de altura, em ABS e acrílico. Carrega em 6 a 8 horas de sol e ilumina até 8 horas por noite, acendendo automaticamente.',
    picture_url: `${SITE}/jardim-principal.jpg`,
  },
  led: {
    id: 'nanda-luminaria-led-sem-fio',
    title: 'Luminária LED Sem Fio',
    description: 'Luminária LED sem fio em ABS de alta resistência, luz branco quente ou branco frio. Instalação fácil, sem fiação.',
    picture_url: 'https://lojaskazamestra.com.br/cdn/shop/files/luminariaLedPilhasPrincipal05_800x.jpg',
  },
  'lampada-led': {
    id: 'nanda-lampada-led-solar-max',
    title: 'Lâmpada LED Solar Max',
    description: 'Lâmpada LED solar portátil com 3 modos de brilho (até 100 lúmens). Bateria Li-ion 400 mAh, carrega pelo painel solar ou USB Type-C. Corpo em ABS + PC, 192 × 60 × 60 mm.',
    picture_url: 'https://userelux.com.br/cdn/shop/files/Disenosintitulo_15_1024x.png?v=1773090670',
  },
};

const CATEGORY = 'home';

function product(productType) {
  return MP_PRODUCTS[productType] || MP_PRODUCTS.solar;
}

const round2 = n => Math.round(n * 100) / 100;
const digits = v => String(v || '').replace(/\D/g, '');

// Itens do pedido: o kit + cada order bump. A soma dos itens é igual ao total
// cobrado (frete e desconto Pix entram no preço do kit).
export function buildItems({ productType, quantity, total, bumps = {}, bumpPrices = {}, bumpUnits = 2 }) {
  const p = product(productType);
  const items = [];
  let kitPrice = total;

  if (bumps.luminaria && bumpPrices.luminaria) {
    items.push({
      id: `${p.id}-bump`,
      title: `${p.title} — +${bumpUnits} unidades (oferta)`,
      description: p.description,
      picture_url: p.picture_url,
      category_id: CATEGORY,
      quantity: 1,
      unit_price: bumpPrices.luminaria,
    });
    kitPrice -= bumpPrices.luminaria;
  }
  if (bumps.envio && bumpPrices.envio) {
    items.push({
      id: 'nanda-envio-priorizado',
      title: 'Envio Priorizado',
      description: 'Prioridade na separação e no envio do pedido.',
      category_id: 'services',
      quantity: 1,
      unit_price: bumpPrices.envio,
    });
    kitPrice -= bumpPrices.envio;
  }

  items.unshift({
    id: p.id,
    title: `${p.title} — Kit ${quantity} unidades`,
    description: p.description,
    picture_url: p.picture_url,
    category_id: CATEGORY,
    quantity: 1,
    unit_price: round2(kitPrice),
  });
  return items;
}

// Item único de uma oferta pós-compra (upsell/downsell)
export function buildOfferItem({ productType, units, price, offer }) {
  const p = product(productType);
  return [{
    id: `${p.id}-${offer}`,
    title: `${p.title} — +${units} unidades`,
    description: p.description,
    picture_url: p.picture_url,
    category_id: CATEGORY,
    quantity: 1,
    unit_price: price,
  }];
}

export function paymentDescription(productType, quantity) {
  return `${product(productType).title} — Kit ${quantity} unidades`;
}

// Telefone no formato do Mercado Pago: DDD + número, sem o 55
export function splitPhone(phone) {
  let d = digits(phone);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length < 10) return null;
  return { area_code: d.slice(0, 2), number: d.slice(2) };
}

// payer (raiz) + additional_info.payer + additional_info.shipments
export function buildPayerInfo({ name, email, cpf, phone, address = {} }) {
  const parts = String(name || '').trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || firstName;
  const zip = digits(address.cep);
  const street = address.street || address.logradouro || '';
  const number = String(address.number || address.numero || '');
  const phoneObj = splitPhone(phone);

  const payer = {
    email: String(email || '').trim().toLowerCase(),
    first_name: firstName,
    last_name: lastName,
    identification: { type: 'CPF', number: digits(cpf) },
    address: {
      zip_code: zip,
      street_name: street,
      street_number: number,
      neighborhood: address.neighborhood || '',
      city: address.city || '',
      federal_unit: address.state || '',
    },
  };

  const additionalPayer = {
    first_name: firstName,
    last_name: lastName,
    address: { zip_code: zip, street_name: street, street_number: number },
  };
  if (phoneObj) additionalPayer.phone = phoneObj;

  const shipments = {
    receiver_address: {
      zip_code: zip,
      state_name: address.state || '',
      city_name: address.city || '',
      street_name: street,
      street_number: number,
      apartment: address.complement || '',
    },
  };

  return { payer, additionalPayer, shipments, firstName, lastName };
}

// IP do comprador (Vercel repassa em x-forwarded-for)
export function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.headers['x-real-ip'] || undefined;
}

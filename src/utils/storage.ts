import { Material, Product, Purchase, Sale, Customer, Supplier, AtelierSettings, RecipeItem, TodoItem, Production } from '../types';

const STORAGE_KEYS = {
  MATERIALS: 'atelie_materials_v1',
  PRODUCTS: 'atelie_products_v1',
  PRODUCTIONS: 'atelie_productions_v1',
  PURCHASES: 'atelie_purchases_v1',
  SALES: 'atelie_sales_v1',
  CUSTOMERS: 'atelie_customers_v1',
  PAYMENT_METHODS: 'atelie_payment_methods_v1',
  SUPPLIERS: 'atelie_suppliers_v1',
  SETTINGS: 'atelie_settings_v1',
  TODOS: 'atelie_todos_v1',
};

export const DEFAULT_TODOS: TodoItem[] = [
  {
    id: 'todo_1',
    text: 'Repor insumos e materiais que estão com estoque baixo',
    completed: false,
    priority: 'high',
    dueDate: '2026-09-15',
    createdAt: '2026-09-10',
  },
  {
    id: 'todo_2',
    text: 'Testar e calcular margem da nova receita de vela em pote âmbar',
    completed: false,
    priority: 'normal',
    dueDate: '2026-09-16',
    createdAt: '2026-09-10',
  },
  {
    id: 'todo_3',
    text: 'Imprimir e laminar rótulos em vinil fosco para encomendas da semana',
    completed: true,
    priority: 'normal',
    createdAt: '2026-09-09',
  },
  {
    id: 'todo_4',
    text: 'Embalar pedido com laço e enviar código de rastreio para o cliente',
    completed: false,
    priority: 'high',
    dueDate: '2026-09-14',
    createdAt: '2026-09-11',
  },
];

export const DEFAULT_SETTINGS: AtelierSettings = {
  atelierName: 'Ateliê Aromas & Luz - Velas Artesanais',
  artisanName: 'Joana Slompo',
  defaultHourlyRate: 38.0, // R$ 38,00/hora de mão de obra da artesã
  defaultFixedCostPercent: 12, // 12% custos fixos (energia panela/soprador, impressora, internet)
  defaultProfitMargin: 50, // 50% margem de lucro desejada para perfumaria
  discountCodes: [
    {
      id: 'discount_familia30',
      code: 'FAMILIA30',
      type: 'percentage',
      value: 50,
      active: true,
      createdAt: '2026-09-21',
    },
  ],
};

export const DEFAULT_SUPPLIERS: Supplier[] = [
  {
    id: 'sup_v1',
    name: 'Ceras & Essências Brasil (Química e Insumos)',
    phone: '(11) 98123-4567',
    email: 'vendas@ceraseessencias.com.br',
    website: 'https://ceraseessencias.com.br',
    notes: 'Distribuidor de cera vegetal de coco T02, ceras para moldes, pavios de algodão e madeira, essências lipossolúveis certificadas IFRA.',
    createdAt: '2026-08-01',
  },
  {
    id: 'sup_v2',
    name: 'Vidraria & Potes Âmbar Brasil',
    phone: '(19) 97234-5678',
    email: 'contato@vidrosambar.com.br',
    website: 'https://vidrosambar.com.br',
    notes: 'Potes de vidro âmbar 200ml, copos foscos brancos, latas travel tin ouro e tampas de pinus/bambu com vedação de silicone.',
    createdAt: '2026-08-03',
  },
  {
    id: 'sup_v3',
    name: 'Papelaria Criativa & Adesivos (Papéis para Rótulos em Casa)',
    phone: '(11) 96345-6789',
    email: 'atendimento@papeisadesivos.com.br',
    website: 'https://papeisadesivos.com.br',
    notes: 'Papel vinil adesivo branco fosco A4 resistente à água para jato de tinta, película de laminação a frio fosca, papel kraft adesivo e papéis cartão para tags.',
    createdAt: '2026-08-05',
  },
  {
    id: 'sup_v4',
    name: 'Embalagens & Caixas Kraft Sustentáveis',
    phone: '(11) 95432-1098',
    email: 'vendas@caixasvelas.com.br',
    website: '',
    notes: 'Caixas microonduladas reforçadas com proteção anticolisão para potes de vidro, papel de seda botânico e caixas rígidas com berço para kits.',
    createdAt: '2026-08-08',
  }
];

export const DEFAULT_MATERIALS: Material[] = [
  // 1. Insumos de Impressão de Rótulos em Casa (Home-Printed Labels)
  {
    id: 'mat_rot_1',
    name: 'Papel Vinil Adesivo Branco Fosco A4 (Pacote com 50)',
    category: 'Rótulos & Papelaria',
    unit: 'folha',
    packageQuantity: 50,
    packageUnit: 'folha',
    packagePrice: 65.00,
    unitCost: 1.30,
    currentStock: 42,
    minStock: 10,
    supplierId: 'sup_v3',
    supplierName: 'Papelaria Criativa & Adesivos (Papéis para Rótulos em Casa)',
    imageUrl: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=400&auto=format&fit=crop&q=80',
    notes: 'Papel vinílico especial para impressora jato de tinta caseira. Alta definição fotográfica, não escorre com gotas de água ou condensação.',
    createdAt: '2026-08-05',
    updatedAt: '2026-09-01',
  },
  {
    id: 'mat_rot_2',
    name: 'Película de Laminação a Frio Fosca Transparente A4 (Pacote com 50)',
    category: 'Rótulos & Papelaria',
    unit: 'folha',
    packageQuantity: 50,
    packageUnit: 'folha',
    packagePrice: 38.00,
    unitCost: 0.76,
    currentStock: 35,
    minStock: 8,
    supplierId: 'sup_v3',
    supplierName: 'Papelaria Criativa & Adesivos (Papéis para Rótulos em Casa)',
    notes: 'Aplicada manualmente com espátula plástica sobre o vinil impresso antes do corte. Protege contra o calor do vidro e manchas de óleo da essência.',
    createdAt: '2026-08-05',
    updatedAt: '2026-08-28',
  },
  {
    id: 'mat_rot_3',
    name: 'Tinta Corante / Pigmentada para Impressora Jato de Tinta (Rateio A4)',
    category: 'Rótulos & Papelaria',
    unit: 'folha',
    packageQuantity: 1000,
    packageUnit: 'folha',
    packagePrice: 60.00,
    unitCost: 0.06,
    currentStock: 850,
    minStock: 150,
    supplierId: 'sup_v3',
    supplierName: 'Papelaria Criativa & Adesivos (Papéis para Rótulos em Casa)',
    notes: 'Estimativa de custo de recarga de tinta (EcoTank/MegaTank) por folha A4 com impressão chapada e gráficos de alta resolução.',
    createdAt: '2026-08-05',
    updatedAt: '2026-08-20',
  },
  {
    id: 'mat_rot_4',
    name: 'Papel Kraft Adesivo 135g A4 (Pacote com 50 folhas)',
    category: 'Rótulos & Papelaria',
    unit: 'folha',
    packageQuantity: 50,
    packageUnit: 'folha',
    packagePrice: 44.00,
    unitCost: 0.88,
    currentStock: 38,
    minStock: 10,
    supplierId: 'sup_v3',
    supplierName: 'Papelaria Criativa & Adesivos (Papéis para Rótulos em Casa)',
    notes: 'Papel adesivo rústico natural. Ideal para os rótulos de fundo com instruções de queima e segurança.',
    createdAt: '2026-08-06',
    updatedAt: '2026-09-02',
  },
  {
    id: 'mat_rot_5',
    name: 'Papel Cartão Offset 240g A4 para Tags (Pacote com 50 folhas)',
    category: 'Rótulos & Papelaria',
    unit: 'folha',
    packageQuantity: 50,
    packageUnit: 'folha',
    packagePrice: 28.00,
    unitCost: 0.56,
    currentStock: 40,
    minStock: 10,
    supplierId: 'sup_v3',
    supplierName: 'Papelaria Criativa & Adesivos (Papéis para Rótulos em Casa)',
    notes: 'Gramatura encorpada para impressão frente e verso das tags botânicas de pirâmide olfativa.',
    createdAt: '2026-08-06',
    updatedAt: '2026-09-01',
  },
  {
    id: 'mat_rot_6',
    name: 'Cordão de Rami / Algodão Cru Encerado 1.5mm (Rolo 100m)',
    category: 'Fitas & Acabamentos',
    unit: 'm',
    packageQuantity: 100,
    packageUnit: 'm',
    packagePrice: 18.00,
    unitCost: 0.18,
    currentStock: 80,
    minStock: 20,
    supplierId: 'sup_v4',
    supplierName: 'Embalagens & Caixas Kraft Sustentáveis',
    notes: 'Amarração rústica nas tampas dos vidros âmbar e fixação das tags aromáticas.',
    createdAt: '2026-08-07',
    updatedAt: '2026-08-25',
  },
  {
    id: 'mat_rot_7',
    name: 'Ilhós Latonado Mini nº 51 Dourado (Cento)',
    category: 'Fitas & Acabamentos',
    unit: 'un',
    packageQuantity: 100,
    packageUnit: 'un',
    packagePrice: 12.00,
    unitCost: 0.12,
    currentStock: 75,
    minStock: 25,
    supplierId: 'sup_v4',
    supplierName: 'Embalagens & Caixas Kraft Sustentáveis',
    notes: 'Acabamento do orifício de passagem do cordão de rami na tag de papel cartão.',
    createdAt: '2026-08-07',
    updatedAt: '2026-08-20',
  },

  // 2. Ceras Vegetais
  {
    id: 'mat_cera_1',
    name: 'Cera Vegetal de Coco T02 (Blend Coco, Palma e Arroz) - Balde 5kg',
    category: 'Ceras & Parafinas',
    unit: 'g',
    packageQuantity: 5000,
    packageUnit: 'g',
    packagePrice: 165.00,
    unitCost: 0.033,
    currentStock: 3800,
    minStock: 1000,
    supplierId: 'sup_v1',
    supplierName: 'Ceras & Essências Brasil (Química e Insumos)',
    imageUrl: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=400&auto=format&fit=crop&q=80',
    notes: 'Ponto de fusão 48°C - 52°C. Proporciona topo liso, aveludado e queima lenta sem resíduos tóxicos.',
    createdAt: '2026-08-01',
    updatedAt: '2026-09-05',
  },
  {
    id: 'mat_cera_2',
    name: 'Cera Vegetal Ecomix para Moldes & Wax Melts (Saco 1kg)',
    category: 'Ceras & Parafinas',
    unit: 'g',
    packageQuantity: 1000,
    packageUnit: 'g',
    packagePrice: 38.00,
    unitCost: 0.038,
    currentStock: 1400,
    minStock: 400,
    supplierId: 'sup_v1',
    supplierName: 'Ceras & Essências Brasil (Química e Insumos)',
    notes: 'Ponto de fusão mais elevado (58°C - 62°C), ideal para desenforme fácil de pastilhas aromáticas e barras de cera.',
    createdAt: '2026-08-02',
    updatedAt: '2026-08-25',
  },

  // 3. Essências Lipossolúveis Premium
  {
    id: 'mat_ess_1',
    name: 'Essência Concentrada Lavanda Francesa & Vanilla (Frasco 100ml)',
    category: 'Essências & Aromas',
    unit: 'ml',
    packageQuantity: 100,
    packageUnit: 'ml',
    packagePrice: 46.00,
    unitCost: 0.46,
    currentStock: 180,
    minStock: 40,
    supplierId: 'sup_v1',
    supplierName: 'Ceras & Essências Brasil (Química e Insumos)',
    imageUrl: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&auto=format&fit=crop&q=80',
    notes: 'Proporção recomendada: 8% a 10% em relação ao peso da cera. Adicionar a 65°C para não evaporar notas de saída.',
    createdAt: '2026-08-01',
    updatedAt: '2026-09-02',
  },
  {
    id: 'mat_ess_2',
    name: 'Essência Concentrada Figo Ambarado & Folhas Verdes (Frasco 100ml)',
    category: 'Essências & Aromas',
    unit: 'ml',
    packageQuantity: 100,
    packageUnit: 'ml',
    packagePrice: 49.00,
    unitCost: 0.49,
    currentStock: 150,
    minStock: 30,
    supplierId: 'sup_v1',
    supplierName: 'Ceras & Essências Brasil (Química e Insumos)',
    notes: 'Aroma sofisticado de alta perfumaria com notas florais e fundo amadeirado doce. Excelente expansão a frio e a quente.',
    createdAt: '2026-08-02',
    updatedAt: '2026-09-03',
  },
  {
    id: 'mat_ess_3',
    name: 'Essência Concentrada Alecrim Silvestre & Capim Limão (Frasco 100ml)',
    category: 'Essências & Aromas',
    unit: 'ml',
    packageQuantity: 100,
    packageUnit: 'ml',
    packagePrice: 44.00,
    unitCost: 0.44,
    currentStock: 130,
    minStock: 30,
    supplierId: 'sup_v1',
    supplierName: 'Ceras & Essências Brasil (Química e Insumos)',
    notes: 'Família herbal refrescante com notas cítricas revitalizantes. Muito procurada para foco e produtividade.',
    createdAt: '2026-08-02',
    updatedAt: '2026-08-30',
  },
  {
    id: 'mat_ess_4',
    name: 'Essência Concentrada Flor de Laranjeira & Bergamota (Frasco 100ml)',
    category: 'Essências & Aromas',
    unit: 'ml',
    packageQuantity: 100,
    packageUnit: 'ml',
    packagePrice: 45.00,
    unitCost: 0.45,
    currentStock: 90,
    minStock: 25,
    supplierId: 'sup_v1',
    supplierName: 'Ceras & Essências Brasil (Química e Insumos)',
    notes: 'Cítrico floral aconchegante perfeito para ambientes de descanso.',
    createdAt: '2026-08-03',
    updatedAt: '2026-08-20',
  },

  // 4. Pavios & Fixação
  {
    id: 'mat_pav_1',
    name: 'Pavio de Algodão Trançado Encerado com Ilhós 15cm (Pacote 50 un)',
    category: 'Pavios & Acessórios',
    unit: 'un',
    packageQuantity: 50,
    packageUnit: 'un',
    packagePrice: 24.00,
    unitCost: 0.48,
    currentStock: 65,
    minStock: 20,
    supplierId: 'sup_v1',
    supplierName: 'Ceras & Essências Brasil (Química e Insumos)',
    notes: 'Pavio trançado 100% puro algodão, banhado em cera vegetal, sem chumbo. Ilhós de 15mm na base.',
    createdAt: '2026-08-01',
    updatedAt: '2026-09-01',
  },
  {
    id: 'mat_pav_2',
    name: 'Pavio de Madeira Laminada Duplo com Suporte Metálico (Pacote 20 un)',
    category: 'Pavios & Acessórios',
    unit: 'un',
    packageQuantity: 20,
    packageUnit: 'un',
    packagePrice: 28.00,
    unitCost: 1.40,
    currentStock: 22,
    minStock: 8,
    supplierId: 'sup_v1',
    supplierName: 'Ceras & Essências Brasil (Química e Insumos)',
    notes: 'Pavio de madeira natural certificada. Ao queimar produz estalos semelhantes ao de lareira crepitante (crackling effect).',
    createdAt: '2026-08-03',
    updatedAt: '2026-09-02',
  },
  {
    id: 'mat_pav_3',
    name: 'Adesivo Dupla-Face Térmico para Pavio (Glue Dot resistente a calor) (Cartela 100 un)',
    category: 'Pavios & Acessórios',
    unit: 'un',
    packageQuantity: 100,
    packageUnit: 'un',
    packagePrice: 13.00,
    unitCost: 0.13,
    currentStock: 120,
    minStock: 30,
    supplierId: 'sup_v1',
    supplierName: 'Ceras & Essências Brasil (Química e Insumos)',
    notes: 'Fixa o ilhós firmemente no fundo do pote de vidro. Não solta quando o vidro esquenta na queima da vela.',
    createdAt: '2026-08-03',
    updatedAt: '2026-08-20',
  },
  {
    id: 'mat_botanico',
    name: 'Mix de Flores Secas Desidratadas (Calêndula & Lavanda) (Pote 50g)',
    category: 'Fitas & Acabamentos',
    unit: 'g',
    packageQuantity: 50,
    packageUnit: 'g',
    packagePrice: 18.00,
    unitCost: 0.36,
    currentStock: 45,
    minStock: 10,
    supplierId: 'sup_v1',
    supplierName: 'Ceras & Essências Brasil (Química e Insumos)',
    notes: 'Para decoração de topo em wax melts e pastilhas aromáticas de cera.',
    createdAt: '2026-08-04',
    updatedAt: '2026-08-15',
  },

  // 5. Frascos, Vidros & Latas
  {
    id: 'mat_rec_1',
    name: 'Pote de Vidro Âmbar 200ml com Tampa de Madeira Torneada Pinus',
    category: 'Frascos & Recipientes',
    unit: 'un',
    packageQuantity: 12,
    packageUnit: 'un',
    packagePrice: 78.00,
    unitCost: 6.50,
    currentStock: 28,
    minStock: 12,
    supplierId: 'sup_v2',
    supplierName: 'Vidraria & Potes Âmbar Brasil',
    imageUrl: 'https://images.unsplash.com/photo-1595872240033-90d2382c4187?w=400&auto=format&fit=crop&q=80',
    notes: 'Vidro espesso resistente a choque térmico. Tampa com anel interno de silicone vedante para reter a essência.',
    createdAt: '2026-08-02',
    updatedAt: '2026-09-04',
  },
  {
    id: 'mat_rec_2',
    name: 'Lata de Alumínio Travel Tin 90g Ouro Nobre com Tampa de Encaixe',
    category: 'Frascos & Recipientes',
    unit: 'un',
    packageQuantity: 20,
    packageUnit: 'un',
    packagePrice: 74.00,
    unitCost: 3.70,
    currentStock: 32,
    minStock: 10,
    supplierId: 'sup_v2',
    supplierName: 'Vidraria & Potes Âmbar Brasil',
    imageUrl: 'https://images.unsplash.com/photo-1572726729437-3732efed37c1?w=400&auto=format&fit=crop&q=80',
    notes: 'Lata sem emenda com verniz interno protetor. Muito procurada para velas de viagem, lembrancinhas e brindes.',
    createdAt: '2026-08-03',
    updatedAt: '2026-09-01',
  },
  {
    id: 'mat_rec_3',
    name: 'Copo de Vidro Branco Fosco (Frosted) 220ml com Tampa de Bambu',
    category: 'Frascos & Recipientes',
    unit: 'un',
    packageQuantity: 10,
    packageUnit: 'un',
    packagePrice: 75.00,
    unitCost: 7.50,
    currentStock: 15,
    minStock: 6,
    supplierId: 'sup_v2',
    supplierName: 'Vidraria & Potes Âmbar Brasil',
    notes: 'Design nórdico contemporâneo e elegante. Efeito translúcido brilhante com a chama acesa.',
    createdAt: '2026-08-04',
    updatedAt: '2026-09-02',
  },
  {
    id: 'mat_rec_4',
    name: 'Blister Clamshell 6 Cavidades para Wax Melts / Pastilhas',
    category: 'Frascos & Recipientes',
    unit: 'un',
    packageQuantity: 25,
    packageUnit: 'un',
    packagePrice: 37.50,
    unitCost: 1.50,
    currentStock: 30,
    minStock: 10,
    supplierId: 'sup_v2',
    supplierName: 'Vidraria & Potes Âmbar Brasil',
    notes: 'Embalagem plástica reciclável para envase direto da cera quente a até 65°C.',
    createdAt: '2026-08-04',
    updatedAt: '2026-08-20',
  },

  // 6. Embalagens & Envio
  {
    id: 'mat_emb_1',
    name: 'Caixa de Papelão Kraft Microondulado 10x10x10cm (Individual)',
    category: 'Embalagens & Envio',
    unit: 'un',
    packageQuantity: 25,
    packageUnit: 'un',
    packagePrice: 57.50,
    unitCost: 2.30,
    currentStock: 35,
    minStock: 10,
    supplierId: 'sup_v4',
    supplierName: 'Embalagens & Caixas Kraft Sustentáveis',
    notes: 'Caixa cúbica reforçada que protege o vidro âmbar durante o transporte dos Correios e transportadoras.',
    createdAt: '2026-08-06',
    updatedAt: '2026-09-03',
  },
  {
    id: 'mat_emb_2',
    name: 'Saquinho de Algodão Cru 15x20cm com Cordão Duplo',
    category: 'Embalagens & Envio',
    unit: 'un',
    packageQuantity: 15,
    packageUnit: 'un',
    packagePrice: 48.00,
    unitCost: 3.20,
    currentStock: 18,
    minStock: 5,
    supplierId: 'sup_v4',
    supplierName: 'Embalagens & Caixas Kraft Sustentáveis',
    notes: 'Embalagem reutilizável premium para presentes e feiras artesanais.',
    createdAt: '2026-08-07',
    updatedAt: '2026-08-28',
  },
  {
    id: 'mat_emb_3',
    name: 'Papel de Seda Botânico Estampado 50x70cm (Pacote com 50)',
    category: 'Embalagens & Envio',
    unit: 'folha',
    packageQuantity: 50,
    packageUnit: 'folha',
    packagePrice: 19.00,
    unitCost: 0.38,
    currentStock: 44,
    minStock: 12,
    supplierId: 'sup_v4',
    supplierName: 'Embalagens & Caixas Kraft Sustentáveis',
    notes: 'Para embrulhar as velas delicadamente dentro das caixas individuais.',
    createdAt: '2026-08-07',
    updatedAt: '2026-09-01',
  },
  {
    id: 'mat_emb_4',
    name: 'Caixa Cartonada Rígida Kraft com Berço para Kit Presente Duo',
    category: 'Embalagens & Envio',
    unit: 'un',
    packageQuantity: 10,
    packageUnit: 'un',
    packagePrice: 62.00,
    unitCost: 6.20,
    currentStock: 12,
    minStock: 4,
    supplierId: 'sup_v4',
    supplierName: 'Embalagens & Caixas Kraft Sustentáveis',
    notes: 'Caixa rígida de luxo para acomodar 1 pote âmbar + 1 wax melts ou difusor.',
    createdAt: '2026-08-08',
    updatedAt: '2026-09-05',
  }
];

// Default products with Sub-product hierarchy!
export const DEFAULT_PRODUCTS: Product[] = [
  // -------------------------------------------------------------
  // SUB-PRODUTOS (Rótulos e Itens Intermediários Feitos em Casa)
  // -------------------------------------------------------------
  {
    id: 'prod_sub_2',
    name: 'Rótulo de Segurança Fundo 5cm (Instruções de Queima)',
    category: 'Rótulos & Papelaria',
    description: 'Etiqueta adesiva obrigatória de segurança colada no fundo do frasco (Warning Label). Contém orientações de segurança, apare do pavio a 5mm, cuidados de queima e peso líquido. Impresso em papel kraft adesivo em casa (12 por folha A4).',
    isIntermediate: true, // SUB-PRODUTO
    items: [
      {
        id: 'ri_s2_1',
        type: 'material',
        targetId: 'mat_rot_4',
        name: 'Papel Kraft Adesivo 135g A4',
        quantity: 0.083, // 1/12 de folha A4
        unit: 'folha',
        unitCost: 0.88,
        totalCost: 0.073,
      },
      {
        id: 'ri_s2_2',
        type: 'material',
        targetId: 'mat_rot_3',
        name: 'Tinta Corante / Pigmentada para Impressora Jato de Tinta',
        quantity: 0.083,
        unit: 'folha',
        unitCost: 0.06,
        totalCost: 0.005,
      }
    ],
    materialsCost: 0.078,
    productionTimeMinutes: 1,
    hourlyRate: 38.0,
    laborCost: 0.63,
    fixedCostPercent: 12,
    fixedCost: 0.09,
    otherCosts: 0.02,
    totalCost: 0.82,
    profitMarginPercent: 30,
    suggestedPrice: 1.17,
    actualPrice: 1.20,
    calculatedMarginPercent: 31.7,
    netProfit: 0.38,
    batchYield: 1,
    unitCostFromBatch: 0.82,
    currentStock: 30,
    minStock: 15,
    createdAt: '2026-08-10',
    updatedAt: '2026-09-01',
  },
  {
    id: 'prod_sub_3',
    name: 'Tag Botânica de Aroma c/ Ilhós Dourado e Cordão de Rami',
    category: 'Rótulos & Papelaria',
    description: 'Tag em papel cartão 240g impresso frente e verso em casa com pirâmide olfativa e cuidados de acendimento. Acabamento com ilhós dourado e cordão de rami para laço no gargalo do frasco.',
    isIntermediate: true, // SUB-PRODUTO
    items: [
      {
        id: 'ri_s3_1',
        type: 'material',
        targetId: 'mat_rot_5',
        name: 'Papel Cartão Offset 240g A4 para Tags',
        quantity: 0.083, // 1/12 de folha
        unit: 'folha',
        unitCost: 0.56,
        totalCost: 0.046,
      },
      {
        id: 'ri_s3_2',
        type: 'material',
        targetId: 'mat_rot_3',
        name: 'Tinta Corante / Pigmentada para Impressora',
        quantity: 0.083,
        unit: 'folha',
        unitCost: 0.06,
        totalCost: 0.005,
      },
      {
        id: 'ri_s3_3',
        type: 'material',
        targetId: 'mat_rot_7',
        name: 'Ilhós Latonado Mini nº 51 Dourado',
        quantity: 1,
        unit: 'un',
        unitCost: 0.12,
        totalCost: 0.12,
      },
      {
        id: 'ri_s3_4',
        type: 'material',
        targetId: 'mat_rot_6',
        name: 'Cordão de Rami / Algodão Cru Encerado 1.5mm',
        quantity: 0.25, // 25cm
        unit: 'm',
        unitCost: 0.18,
        totalCost: 0.045,
      }
    ],
    materialsCost: 0.216,
    productionTimeMinutes: 2,
    hourlyRate: 38.0,
    laborCost: 1.27,
    fixedCostPercent: 12,
    fixedCost: 0.18,
    otherCosts: 0.04,
    totalCost: 1.70,
    profitMarginPercent: 35,
    suggestedPrice: 2.62,
    actualPrice: 2.50,
    calculatedMarginPercent: 32.0,
    netProfit: 0.80,
    batchYield: 1,
    unitCostFromBatch: 1.70,
    currentStock: 18,
    minStock: 10,
    createdAt: '2026-08-11',
    updatedAt: '2026-09-02',
  },
  {
    id: 'prod_sub_4',
    name: 'Rótulo Adesivo Redondo para Tampa de Lata 6.5cm',
    category: 'Rótulos & Papelaria',
    description: 'Rótulo circular vinílico fosco para tampa de latas travel tin 90g, com alta durabilidade e laminação a frio.',
    isIntermediate: true, // SUB-PRODUTO
    items: [
      {
        id: 'ri_s4_1',
        type: 'material',
        targetId: 'mat_rot_1',
        name: 'Papel Vinil Adesivo Branco Fosco A4',
        quantity: 0.125, // 1/8 de folha
        unit: 'folha',
        unitCost: 1.30,
        totalCost: 0.163,
      },
      {
        id: 'ri_s4_2',
        type: 'material',
        targetId: 'mat_rot_2',
        name: 'Película de Laminação a Frio Fosca Transparente',
        quantity: 0.125,
        unit: 'folha',
        unitCost: 0.76,
        totalCost: 0.095,
      },
      {
        id: 'ri_s4_3',
        type: 'material',
        targetId: 'mat_rot_3',
        name: 'Tinta Corante / Pigmentada para Impressora',
        quantity: 0.125,
        unit: 'folha',
        unitCost: 0.06,
        totalCost: 0.008,
      }
    ],
    materialsCost: 0.266,
    productionTimeMinutes: 1.5,
    hourlyRate: 38.0,
    laborCost: 0.95,
    fixedCostPercent: 12,
    fixedCost: 0.15,
    otherCosts: 0.04,
    totalCost: 1.40,
    profitMarginPercent: 35,
    suggestedPrice: 2.15,
    actualPrice: 2.00,
    calculatedMarginPercent: 30.0,
    netProfit: 0.60,
    batchYield: 1,
    unitCostFromBatch: 1.40,
    currentStock: 22,
    minStock: 10,
    createdAt: '2026-08-11',
    updatedAt: '2026-09-02',
  },

  // -------------------------------------------------------------
  // PRODUTOS FINAIS (Velas Aromáticas, Wax Melts e Kits Prontos)
  // -------------------------------------------------------------
  {
    id: 'prod_final_1',
    name: 'Vela Aromática Cera de Coco 140g Pote Âmbar - Lavanda & Vanilla',
    category: 'Velas em Vidro',
    description: 'Vela perfumada nobre em pote de vidro âmbar 200ml com tampa torneada de madeira pinus. Blend vegetal 100% de cera de coco e 10% de essência pura de lavanda francesa com fava de baunilha. Queima limpa de 30 a 35 horas.',
    isIntermediate: false,
    imageUrl: 'https://images.unsplash.com/photo-1595872240033-90d2382c4187?w=400&auto=format&fit=crop&q=80',
    items: [
      {
        id: 'ri_f1_1',
        type: 'material',
        targetId: 'mat_cera_1',
        name: 'Cera Vegetal de Coco T02 (Blend Coco, Palma e Arroz)',
        quantity: 135, // 135g
        unit: 'g',
        unitCost: 0.033,
        totalCost: 4.455,
      },
      {
        id: 'ri_f1_2',
        type: 'material',
        targetId: 'mat_ess_1',
        name: 'Essência Concentrada Lavanda Francesa & Vanilla',
        quantity: 15, // 15ml (10% de concentração aromática)
        unit: 'ml',
        unitCost: 0.46,
        totalCost: 6.90,
      },
      {
        id: 'ri_f1_3',
        type: 'material',
        targetId: 'mat_pav_1',
        name: 'Pavio de Algodão Trançado Encerado com Ilhós 15cm',
        quantity: 1,
        unit: 'un',
        unitCost: 0.48,
        totalCost: 0.48,
      },
      {
        id: 'ri_f1_4',
        type: 'material',
        targetId: 'mat_pav_3',
        name: 'Adesivo Dupla-Face Térmico para Pavio (Glue Dot)',
        quantity: 1,
        unit: 'un',
        unitCost: 0.13,
        totalCost: 0.13,
      },
      {
        id: 'ri_f1_5',
        type: 'material',
        targetId: 'mat_rec_1',
        name: 'Pote de Vidro Âmbar 200ml com Tampa de Madeira Torneada',
        quantity: 1,
        unit: 'un',
        unitCost: 6.50,
        totalCost: 6.50,
      },
      // SUB-PRODUTOS DE RÓTULOS IMPRESSOS EM CASA!
      {
        id: 'ri_f1_6',
        type: 'material',
        targetId: 'mat_rot_1',
        name: 'Rótulo Frontal Vinílico Fosco 6x6cm',
        quantity: 1,
        unit: 'un',
        unitCost: 1.86,
        totalCost: 1.86,
      },
      {
        id: 'ri_f1_7',
        type: 'product',
        targetId: 'prod_sub_2',
        name: 'Rótulo de Segurança Fundo 5cm (Instruções de Queima)',
        quantity: 1,
        unit: 'un',
        unitCost: 0.82,
        totalCost: 0.82,
      },
      {
        id: 'ri_f1_8',
        type: 'product',
        targetId: 'prod_sub_3',
        name: 'Tag Botânica de Aroma c/ Ilhós Dourado e Cordão de Rami',
        quantity: 1,
        unit: 'un',
        unitCost: 1.70,
        totalCost: 1.70,
      },
      {
        id: 'ri_f1_9',
        type: 'material',
        targetId: 'mat_emb_1',
        name: 'Caixa de Papelão Kraft Microondulado 10x10x10cm (Individual)',
        quantity: 1,
        unit: 'un',
        unitCost: 2.30,
        totalCost: 2.30,
      },
      {
        id: 'ri_f1_10',
        type: 'material',
        targetId: 'mat_emb_3',
        name: 'Papel de Seda Botânico Estampado 50x70cm',
        quantity: 0.5,
        unit: 'folha',
        unitCost: 0.38,
        totalCost: 0.19,
      }
    ],
    materialsCost: 25.335,
    productionTimeMinutes: 25, // Pesagem, fusão lenta, homogeneização a 65°C, envase a 55°C, corte do pavio e rotulagem
    hourlyRate: 38.0,
    laborCost: 15.83, // (25/60)*38
    fixedCostPercent: 12,
    fixedCost: 4.94,
    otherCosts: 1.50, // Energia, soprador térmico, fita de caixa
    totalCost: 47.61,
    profitMarginPercent: 48,
    suggestedPrice: 91.56,
    actualPrice: 92.00,
    calculatedMarginPercent: 48.2,
    netProfit: 44.39,
    batchYield: 1,
    unitCostFromBatch: 47.61,
    currentStock: 8,
    minStock: 4,
    createdAt: '2026-08-15',
    updatedAt: '2026-09-05',
  },
  {
    id: 'prod_final_2',
    name: 'Vela Travel Tin 90g Ouro Nobre - Alecrim & Capim Limão',
    category: 'Velas em Latas',
    description: 'Vela prática e resistente em lata de alumínio ouro de 90g. Não quebra na mala, perfeita para viagens, brindes corporativos e lembrancinhas de festas.',
    isIntermediate: false,
    imageUrl: 'https://images.unsplash.com/photo-1572726729437-3732efed37c1?w=400&auto=format&fit=crop&q=80',
    items: [
      {
        id: 'ri_f2_1',
        type: 'material',
        targetId: 'mat_cera_1',
        name: 'Cera Vegetal de Coco T02',
        quantity: 80,
        unit: 'g',
        unitCost: 0.033,
        totalCost: 2.64,
      },
      {
        id: 'ri_f2_2',
        type: 'material',
        targetId: 'mat_ess_3',
        name: 'Essência Concentrada Alecrim Silvestre & Capim Limão',
        quantity: 9,
        unit: 'ml',
        unitCost: 0.44,
        totalCost: 3.96,
      },
      {
        id: 'ri_f2_3',
        type: 'material',
        targetId: 'mat_pav_1',
        name: 'Pavio de Algodão Trançado Encerado com Ilhós 15cm',
        quantity: 1,
        unit: 'un',
        unitCost: 0.48,
        totalCost: 0.48,
      },
      {
        id: 'ri_f2_4',
        type: 'material',
        targetId: 'mat_pav_3',
        name: 'Adesivo Dupla-Face Térmico para Pavio (Glue Dot)',
        quantity: 1,
        unit: 'un',
        unitCost: 0.13,
        totalCost: 0.13,
      },
      {
        id: 'ri_f2_5',
        type: 'material',
        targetId: 'mat_rec_2',
        name: 'Lata de Alumínio Travel Tin 90g Ouro Nobre',
        quantity: 1,
        unit: 'un',
        unitCost: 3.70,
        totalCost: 3.70,
      },
      {
        id: 'ri_f2_6',
        type: 'product',
        targetId: 'prod_sub_4',
        name: 'Rótulo Adesivo Redondo para Tampa de Lata 6.5cm',
        quantity: 1,
        unit: 'un',
        unitCost: 1.40,
        totalCost: 1.40,
      },
      {
        id: 'ri_f2_7',
        type: 'product',
        targetId: 'prod_sub_2',
        name: 'Rótulo de Segurança Fundo 5cm (Instruções de Queima)',
        quantity: 1,
        unit: 'un',
        unitCost: 0.82,
        totalCost: 0.82,
      },
      {
        id: 'ri_f2_8',
        type: 'material',
        targetId: 'mat_emb_3',
        name: 'Papel de Seda Botânico Estampado 50x70cm',
        quantity: 0.5,
        unit: 'folha',
        unitCost: 0.38,
        totalCost: 0.19,
      }
    ],
    materialsCost: 13.32,
    productionTimeMinutes: 16,
    hourlyRate: 38.0,
    laborCost: 10.13,
    fixedCostPercent: 12,
    fixedCost: 2.81,
    otherCosts: 0.90,
    totalCost: 27.16,
    profitMarginPercent: 50,
    suggestedPrice: 54.32,
    actualPrice: 55.00,
    calculatedMarginPercent: 50.6,
    netProfit: 27.84,
    batchYield: 1,
    unitCostFromBatch: 27.16,
    currentStock: 12,
    minStock: 5,
    createdAt: '2026-08-16',
    updatedAt: '2026-09-02',
  },
  {
    id: 'prod_final_3',
    name: 'Vela Premium Pavio de Madeira 200g - Figo Ambarado & Vanilla',
    category: 'Velas em Vidro',
    description: 'Vela luxo em copo de vidro branco fosco com tampa natural de bambu e pavio duplo de madeira natural. Proporciona queima crepitante com chama alongada e aconchegante.',
    isIntermediate: false,
    imageUrl: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=400&auto=format&fit=crop&q=80',
    items: [
      {
        id: 'ri_f3_1',
        type: 'material',
        targetId: 'mat_cera_1',
        name: 'Cera Vegetal de Coco T02',
        quantity: 180,
        unit: 'g',
        unitCost: 0.033,
        totalCost: 5.94,
      },
      {
        id: 'ri_f3_2',
        type: 'material',
        targetId: 'mat_ess_2',
        name: 'Essência Concentrada Figo Ambarado & Folhas Verdes',
        quantity: 20, // 20ml (10% de carga)
        unit: 'ml',
        unitCost: 0.49,
        totalCost: 9.80,
      },
      {
        id: 'ri_f3_3',
        type: 'material',
        targetId: 'mat_pav_2',
        name: 'Pavio de Madeira Laminada Duplo com Suporte Metálico',
        quantity: 1,
        unit: 'un',
        unitCost: 1.40,
        totalCost: 1.40,
      },
      {
        id: 'ri_f3_4',
        type: 'material',
        targetId: 'mat_pav_3',
        name: 'Adesivo Dupla-Face Térmico para Pavio',
        quantity: 1,
        unit: 'un',
        unitCost: 0.13,
        totalCost: 0.13,
      },
      {
        id: 'ri_f3_5',
        type: 'material',
        targetId: 'mat_rec_3',
        name: 'Copo de Vidro Branco Fosco 220ml com Tampa de Bambu',
        quantity: 1,
        unit: 'un',
        unitCost: 7.50,
        totalCost: 7.50,
      },
      {
        id: 'ri_f3_6',
        type: 'material',
        targetId: 'mat_rot_1',
        name: 'Rótulo Frontal Vinílico Fosco 6x6cm',
        quantity: 1,
        unit: 'un',
        unitCost: 1.86,
        totalCost: 1.86,
      },
      {
        id: 'ri_f3_7',
        type: 'product',
        targetId: 'prod_sub_2',
        name: 'Rótulo de Segurança Fundo 5cm (Instruções de Queima)',
        quantity: 1,
        unit: 'un',
        unitCost: 0.82,
        totalCost: 0.82,
      },
      {
        id: 'ri_f3_8',
        type: 'product',
        targetId: 'prod_sub_3',
        name: 'Tag Botânica de Aroma c/ Ilhós Dourado e Cordão de Rami',
        quantity: 1,
        unit: 'un',
        unitCost: 1.70,
        totalCost: 1.70,
      },
      {
        id: 'ri_f3_9',
        type: 'material',
        targetId: 'mat_emb_1',
        name: 'Caixa de Papelão Kraft Microondulado 10x10x10cm',
        quantity: 1,
        unit: 'un',
        unitCost: 2.30,
        totalCost: 2.30,
      }
    ],
    materialsCost: 31.45,
    productionTimeMinutes: 30,
    hourlyRate: 38.0,
    laborCost: 19.00,
    fixedCostPercent: 12,
    fixedCost: 6.05,
    otherCosts: 2.00,
    totalCost: 58.50,
    profitMarginPercent: 52,
    suggestedPrice: 121.88,
    actualPrice: 125.00,
    calculatedMarginPercent: 53.2,
    netProfit: 66.50,
    batchYield: 1,
    unitCostFromBatch: 58.50,
    currentStock: 3,
    minStock: 4,
    createdAt: '2026-08-18',
    updatedAt: '2026-09-04',
  },
  {
    id: 'prod_final_4',
    name: 'Barra de Pastilhas Aromáticas (Wax Melts) 60g - Flor de Laranjeira',
    category: 'Wax Melts & Aromatizadores',
    description: 'Tablete de 6 pastilhas de cera vegetal com alta concentração aromática e pétalas botânicas de calêndula para derreter em difusor ou rechaud de cerâmica.',
    isIntermediate: true, // PODE SER VENDIDO AVULSO OU USADO NO KIT!
    imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
    items: [
      {
        id: 'ri_f4_1',
        type: 'material',
        targetId: 'mat_cera_2',
        name: 'Cera Vegetal Ecomix para Moldes & Wax Melts',
        quantity: 54, // 54g
        unit: 'g',
        unitCost: 0.038,
        totalCost: 2.052,
      },
      {
        id: 'ri_f4_2',
        type: 'material',
        targetId: 'mat_ess_4',
        name: 'Essência Concentrada Flor de Laranjeira & Bergamota',
        quantity: 6, // 6ml (10% de essência)
        unit: 'ml',
        unitCost: 0.45,
        totalCost: 2.70,
      },
      {
        id: 'ri_f4_3',
        type: 'material',
        targetId: 'mat_botanico',
        name: 'Mix de Flores Secas Desidratadas (Calêndula & Lavanda)',
        quantity: 2,
        unit: 'g',
        unitCost: 0.36,
        totalCost: 0.72,
      },
      {
        id: 'ri_f4_4',
        type: 'material',
        targetId: 'mat_rec_4',
        name: 'Blister Clamshell 6 Cavidades para Wax Melts',
        quantity: 1,
        unit: 'un',
        unitCost: 1.50,
        totalCost: 1.50,
      },
      {
        id: 'ri_f4_5',
        type: 'material',
        targetId: 'mat_rot_1',
        name: 'Rótulo Frontal Vinílico Fosco 6x6cm',
        quantity: 1,
        unit: 'un',
        unitCost: 1.86,
        totalCost: 1.86,
      }
    ],
    materialsCost: 8.832,
    productionTimeMinutes: 12,
    hourlyRate: 38.0,
    laborCost: 7.60,
    fixedCostPercent: 12,
    fixedCost: 1.97,
    otherCosts: 0.60,
    totalCost: 19.00,
    profitMarginPercent: 47,
    suggestedPrice: 35.85,
    actualPrice: 36.00,
    calculatedMarginPercent: 47.2,
    netProfit: 17.00,
    batchYield: 1,
    unitCostFromBatch: 19.00,
    currentStock: 7,
    minStock: 3,
    createdAt: '2026-08-20',
    updatedAt: '2026-09-02',
  },
  {
    id: 'prod_final_5',
    name: 'Kit Presente Ritual Aconchego (Vela Âmbar + Wax Melts + Caixa Rígida)',
    category: 'Kits & Presentes',
    description: 'Conjunto presenteável de alta sofisticação: 1 Vela Âmbar 140g Lavanda & Vanilla + 1 Barra de Wax Melts Flor de Laranjeira, acomodados em caixa cartonada rígida com berço de papel de seda e laço de rami.',
    isIntermediate: false,
    imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=400&auto=format&fit=crop&q=80',
    items: [
      // PRODUTOS INTEGRAIS COMO SUB-PRODUTOS!
      {
        id: 'ri_f5_1',
        type: 'product',
        targetId: 'prod_final_1',
        name: 'Vela Aromática Cera de Coco 140g Pote Âmbar - Lavanda & Vanilla',
        quantity: 1,
        unit: 'un',
        unitCost: 47.61,
        totalCost: 47.61,
      },
      {
        id: 'ri_f5_2',
        type: 'product',
        targetId: 'prod_final_4',
        name: 'Barra de Pastilhas Aromáticas (Wax Melts) 60g - Flor de Laranjeira',
        quantity: 1,
        unit: 'un',
        unitCost: 19.00,
        totalCost: 19.00,
      },
      {
        id: 'ri_f5_3',
        type: 'material',
        targetId: 'mat_emb_4',
        name: 'Caixa Cartonada Rígida Kraft com Berço para Kit Presente',
        quantity: 1,
        unit: 'un',
        unitCost: 6.20,
        totalCost: 6.20,
      },
      {
        id: 'ri_f5_4',
        type: 'material',
        targetId: 'mat_emb_3',
        name: 'Papel de Seda Botânico Estampado 50x70cm',
        quantity: 1,
        unit: 'folha',
        unitCost: 0.38,
        totalCost: 0.38,
      },
      {
        id: 'ri_f5_5',
        type: 'material',
        targetId: 'mat_rot_6',
        name: 'Cordão de Rami / Algodão Cru Encerado 1.5mm',
        quantity: 1,
        unit: 'm',
        unitCost: 0.18,
        totalCost: 0.18,
      }
    ],
    materialsCost: 73.37,
    productionTimeMinutes: 10,
    hourlyRate: 38.0,
    laborCost: 6.33,
    fixedCostPercent: 12,
    fixedCost: 9.56,
    otherCosts: 1.50,
    totalCost: 90.76,
    profitMarginPercent: 48,
    suggestedPrice: 174.54,
    actualPrice: 175.00,
    calculatedMarginPercent: 48.1,
    netProfit: 84.24,
    batchYield: 1,
    unitCostFromBatch: 90.76,
    currentStock: 2,
    minStock: 2,
    createdAt: '2026-08-22',
    updatedAt: '2026-09-04',
  }
];

export const DEFAULT_PURCHASES: Purchase[] = [
  {
    id: 'pur_v1',
    date: '2026-08-05',
    supplierId: 'sup_v1',
    supplierName: 'Ceras & Essências Brasil (Química e Insumos)',
    invoiceNumber: 'NF-34891',
    shippingCost: 28.00,
    totalAmount: 476.00,
    items: [
      {
        materialId: 'mat_cera_1',
        materialName: 'Cera Vegetal de Coco T02 - Balde 5kg',
        quantity: 1,
        unit: 'g',
        packagePrice: 165.00,
        totalPrice: 165.00,
      },
      {
        materialId: 'mat_ess_1',
        materialName: 'Essência Concentrada Lavanda Francesa (100ml)',
        quantity: 2,
        unit: 'ml',
        packagePrice: 46.00,
        totalPrice: 92.00,
      },
      {
        materialId: 'mat_ess_2',
        materialName: 'Essência Concentrada Figo Ambarado (100ml)',
        quantity: 2,
        unit: 'ml',
        packagePrice: 49.00,
        totalPrice: 98.00,
      },
      {
        materialId: 'mat_pav_1',
        materialName: 'Pavio de Algodão Trançado Encerado (50 un)',
        quantity: 1,
        unit: 'un',
        packagePrice: 24.00,
        totalPrice: 24.00,
      },
      {
        materialId: 'mat_pav_2',
        materialName: 'Pavio de Madeira Laminada Duplo (20 un)',
        quantity: 1,
        unit: 'un',
        packagePrice: 28.00,
        totalPrice: 28.00,
      },
      {
        materialId: 'mat_pav_3',
        materialName: 'Adesivo Dupla-Face Térmico Glue Dot (100 un)',
        quantity: 1,
        unit: 'un',
        packagePrice: 13.00,
        totalPrice: 13.00,
      },
      {
        materialId: 'mat_cera_2',
        materialName: 'Cera Vegetal Ecomix para Moldes (1kg)',
        quantity: 1,
        unit: 'g',
        packagePrice: 38.00,
        totalPrice: 38.00,
      }
    ],
    notes: 'Insumos básicos de reposição para início da produção de velas artesanais.',
    createdAt: '2026-08-05',
  },
  {
    id: 'pur_v2',
    date: '2026-08-10',
    supplierId: 'sup_v2',
    supplierName: 'Vidraria & Potes Âmbar Brasil',
    invoiceNumber: 'NF-1982',
    shippingCost: 35.00,
    totalAmount: 375.50,
    items: [
      {
        materialId: 'mat_rec_1',
        materialName: 'Pote de Vidro Âmbar 200ml c/ Tampa Pinus (12 un)',
        quantity: 2,
        unit: 'un',
        packagePrice: 78.00,
        totalPrice: 156.00,
      },
      {
        materialId: 'mat_rec_2',
        materialName: 'Lata de Alumínio Travel Tin 90g Ouro (20 un)',
        quantity: 1,
        unit: 'un',
        packagePrice: 74.00,
        totalPrice: 74.00,
      },
      {
        materialId: 'mat_rec_3',
        materialName: 'Copo de Vidro Branco Fosco 220ml c/ Tampa Bambu (10 un)',
        quantity: 1,
        unit: 'un',
        packagePrice: 75.00,
        totalPrice: 75.00,
      },
      {
        materialId: 'mat_rec_4',
        materialName: 'Blister Clamshell 6 Cavidades para Wax Melts (25 un)',
        quantity: 1,
        unit: 'un',
        packagePrice: 37.50,
        totalPrice: 37.50,
      }
    ],
    notes: 'Embalagens de vidro e alumínio embaladas com proteção antichoque.',
    createdAt: '2026-08-10',
  },
  {
    id: 'pur_v3',
    date: '2026-08-15',
    supplierId: 'sup_v3',
    supplierName: 'Papelaria Criativa & Adesivos (Papéis para Rótulos em Casa)',
    invoiceNumber: 'PED-7721',
    shippingCost: 0,
    totalAmount: 235.00,
    items: [
      {
        materialId: 'mat_rot_1',
        materialName: 'Papel Vinil Adesivo Branco Fosco A4 (50 folhas)',
        quantity: 1,
        unit: 'folha',
        packagePrice: 65.00,
        totalPrice: 65.00,
      },
      {
        materialId: 'mat_rot_2',
        materialName: 'Película de Laminação a Frio Fosca A4 (50 folhas)',
        quantity: 1,
        unit: 'folha',
        packagePrice: 38.00,
        totalPrice: 38.00,
      },
      {
        materialId: 'mat_rot_4',
        materialName: 'Papel Kraft Adesivo 135g A4 (50 folhas)',
        quantity: 1,
        unit: 'folha',
        packagePrice: 44.00,
        totalPrice: 44.00,
      },
      {
        materialId: 'mat_rot_5',
        materialName: 'Papel Cartão Offset 240g A4 para Tags (50 folhas)',
        quantity: 1,
        unit: 'folha',
        packagePrice: 28.00,
        totalPrice: 28.00,
      },
      {
        materialId: 'mat_rot_3',
        materialName: 'Tinta Corante/Pigmentada Recarga para Impressora',
        quantity: 1,
        unit: 'folha',
        packagePrice: 60.00,
        totalPrice: 60.00,
      }
    ],
    notes: 'Materiais para confecção dos próprios rótulos e etiquetas em casa na impressora.',
    createdAt: '2026-08-15',
  },
  {
    id: 'pur_v4',
    date: '2026-08-20',
    supplierId: 'sup_v4',
    supplierName: 'Embalagens & Caixas Kraft Sustentáveis',
    invoiceNumber: 'NF-6610',
    shippingCost: 22.00,
    totalAmount: 200.50,
    items: [
      {
        materialId: 'mat_emb_1',
        materialName: 'Caixa de Papelão Kraft Microondulado 10x10x10cm (25 un)',
        quantity: 2,
        unit: 'un',
        packagePrice: 57.50,
        totalPrice: 115.00,
      },
      {
        materialId: 'mat_emb_3',
        materialName: 'Papel de Seda Botânico Estampado (50 folhas)',
        quantity: 1,
        unit: 'folha',
        packagePrice: 19.00,
        totalPrice: 19.00,
      },
      {
        materialId: 'mat_rot_6',
        materialName: 'Cordão de Rami / Algodão Cru 1.5mm (100m)',
        quantity: 1,
        unit: 'm',
        packagePrice: 18.00,
        totalPrice: 18.00,
      },
      {
        materialId: 'mat_rot_7',
        materialName: 'Ilhós Latonado Mini nº 51 Dourado (100 un)',
        quantity: 1,
        unit: 'un',
        packagePrice: 12.00,
        totalPrice: 12.00,
      },
      {
        materialId: 'mat_emb_2',
        materialName: 'Saquinho de Algodão Cru 15x20cm (15 un)',
        quantity: 1,
        unit: 'un',
        packagePrice: 48.00,
        totalPrice: 48.00,
      }
    ],
    notes: 'Caixas de envio reforçadas para evitar quebra de vidros no frete.',
    createdAt: '2026-08-20',
  }
];

export const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: 'cust_v1',
    name: 'Fernanda Meirelles',
    phone: '(11) 98765-4321',
    birthdate: '1991-04-18',
    email: 'fernanda.meirelles@gmail.com',
    notes: 'Adora aromas florais e frascos âmbar. Compra com frequência pelo Instagram.',
    createdAt: '2026-08-15',
  },
  {
    id: 'cust_v2',
    name: 'Renato Silveira',
    phone: '(19) 99123-5566',
    birthdate: '1985-11-09',
    email: 'renato.silveira@outlook.com',
    notes: 'Preferência por velas cítricas e herbal (Alecrim e Capim Limão).',
    createdAt: '2026-08-20',
  },
  {
    id: 'cust_v3',
    name: 'Beatriz Vasconcelos',
    phone: '(21) 98112-9988',
    birthdate: '1993-09-18',
    email: 'beatriz.vasc@hotmail.com',
    notes: 'Conheceu o ateliê na feira criativa. Apaixonada por pavio de madeira crepitante.',
    createdAt: '2026-08-28',
  },
  {
    id: 'cust_v4',
    name: 'Mariana Duarte',
    phone: '(31) 99877-3344',
    birthdate: '1989-09-25',
    email: 'mari.duarte@gmail.com',
    notes: 'Fã de wax melts e pastilhas perfumadas. Sempre pede aroma Flor de Laranjeira.',
    createdAt: '2026-09-01',
  },
  {
    id: 'cust_v5',
    name: 'Camila Alencar',
    phone: '(41) 98822-1100',
    birthdate: '1996-01-30',
    email: 'camila.alencar@design.com.br',
    notes: 'Cliente de kits presentes personalizados com laços e mensagens.',
    createdAt: '2026-09-05',
  },
  {
    id: 'cust_v6',
    name: 'Amanda Silva',
    phone: '(11) 99443-2211',
    birthdate: '1994-09-10',
    email: 'amanda.silva@yahoo.com.br',
    notes: 'Interessada em velas para lembrancinhas de batizado e casamento.',
    createdAt: '2026-09-08',
  },
];

export const DEFAULT_PAYMENT_METHODS: string[] = [
  'offline',
  'site',
  'Pix',
  'Cartão de Crédito',
  'Dinheiro',
];

export const DEFAULT_SALES: Sale[] = [
  {
    id: 'sale_v1',
    date: '2026-09-02',
    productId: 'prod_final_1',
    productName: 'Vela Aromática Cera de Coco 140g Pote Âmbar - Lavanda & Vanilla',
    productImageUrl: 'https://images.unsplash.com/photo-1595872240033-90d2382c4187?w=400&auto=format&fit=crop&q=80',
    quantity: 3,
    unitPrice: 92.00,
    unitCost: 47.61,
    totalRevenue: 276.00,
    totalCost: 142.83,
    totalProfit: 133.17,
    marginPercent: 48.2,
    customerId: 'cust_v1',
    customerName: 'Fernanda Meirelles',
    customerContact: '(11) 98765-4321',
    channel: 'Instagram Direct',
    paymentMethod: 'site',
    orderType: 'pronta_entrega',
    deliveryStatus: 'entregue',
    deliveryActualDate: '2026-09-02',
    paymentStatus: 'pago',
    paymentActualDate: '2026-09-02',
    notes: 'Cliente elogiou o acabamento do rótulo e a fragrância suave.',
    createdAt: '2026-09-02',
  },
  {
    id: 'sale_v2',
    date: '2026-09-04',
    productId: 'prod_final_2',
    productName: 'Vela Travel Tin 90g Ouro Nobre - Alecrim & Capim Limão',
    productImageUrl: 'https://images.unsplash.com/photo-1572726729437-3732efed37c1?w=400&auto=format&fit=crop&q=80',
    quantity: 2,
    unitPrice: 55.00,
    unitCost: 27.16,
    totalRevenue: 110.00,
    totalCost: 54.32,
    totalProfit: 55.68,
    marginPercent: 50.6,
    customerId: 'cust_v2',
    customerName: 'Renato Silveira',
    customerContact: '(19) 99123-5566',
    channel: 'WhatsApp',
    paymentMethod: 'offline',
    orderType: 'pronta_entrega',
    deliveryStatus: 'entregue',
    deliveryActualDate: '2026-09-04',
    paymentStatus: 'pago',
    paymentActualDate: '2026-09-04',
    notes: 'Lembrancinha de viagem.',
    createdAt: '2026-09-04',
  },
  {
    id: 'sale_v3',
    date: '2026-09-07',
    productId: 'prod_final_3',
    productName: 'Vela Premium Pavio de Madeira 200g - Figo Ambarado & Vanilla',
    productImageUrl: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=400&auto=format&fit=crop&q=80',
    quantity: 2,
    unitPrice: 125.00,
    unitCost: 58.50,
    totalRevenue: 250.00,
    totalCost: 117.00,
    totalProfit: 133.00,
    marginPercent: 53.2,
    customerId: 'cust_v3',
    customerName: 'Beatriz Vasconcelos',
    customerContact: '(21) 98112-9988',
    channel: 'Feira Criativa de Artesanato',
    paymentMethod: 'offline',
    orderType: 'pronta_entrega',
    deliveryStatus: 'entregue',
    deliveryActualDate: '2026-09-07',
    paymentStatus: 'pago',
    paymentActualDate: '2026-09-07',
    notes: 'Venda presencial em feira artesanal.',
    createdAt: '2026-09-07',
  },
  {
    id: 'sale_v4',
    date: '2026-09-10',
    productId: 'prod_final_4',
    productName: 'Barra de Pastilhas Aromáticas (Wax Melts) 60g - Flor de Laranjeira',
    productImageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
    quantity: 6,
    unitPrice: 36.00,
    unitCost: 19.00,
    totalRevenue: 216.00,
    totalCost: 114.00,
    totalProfit: 102.00,
    marginPercent: 47.2,
    customerId: 'cust_v4',
    customerName: 'Mariana Duarte',
    customerContact: '(31) 99877-3344',
    channel: 'Elo7',
    paymentMethod: 'site',
    orderType: 'encomenda',
    deliveryStatus: 'pendente_entrega',
    deliveryScheduledDate: '2026-09-16',
    paymentStatus: 'pago',
    paymentActualDate: '2026-09-10',
    notes: 'Produzir lote fresco para presente de aniversário. Entregar até dia 16/09.',
    createdAt: '2026-09-10',
  },
  {
    id: 'sale_v5',
    date: '2026-09-12',
    productId: 'prod_final_5',
    productName: 'Kit Presente Ritual Aconchego (Vela Âmbar + Wax Melts + Caixa Rígida)',
    productImageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=400&auto=format&fit=crop&q=80',
    quantity: 2,
    unitPrice: 175.00,
    unitCost: 90.76,
    totalRevenue: 350.00,
    totalCost: 181.52,
    totalProfit: 168.48,
    marginPercent: 48.1,
    customerId: 'cust_v5',
    customerName: 'Camila Alencar',
    customerContact: '(41) 98822-1100',
    channel: 'Instagram Direct',
    paymentMethod: 'offline',
    orderType: 'encomenda',
    deliveryStatus: 'pendente_entrega',
    deliveryScheduledDate: '2026-09-18',
    paymentStatus: 'pendente_pagamento',
    paymentScheduledDate: '2026-09-18',
    notes: 'Encomenda com laço especial. Combinado pagamento na entrega (50% restante via Pix).',
    createdAt: '2026-09-12',
  }
];

export const DEFAULT_PRODUCTIONS: Production[] = [
  {
    id: 'prod_exec_1',
    date: '2026-09-01',
    productId: 'prod_final_1',
    productName: 'Vela Aromática Cera de Coco 140g Pote Âmbar - Lavanda & Vanilla',
    productCategory: 'Velas em Vidro',
    productImageUrl: 'https://images.unsplash.com/photo-1595872240033-90d2382c4187?w=400&auto=format&fit=crop&q=80',
    isIntermediate: false,
    batchYield: 1,
    batchCount: 8,
    quantityProduced: 8,
    costPerUnit: 47.61,
    totalCost: 380.88,
    deductedItems: [
      {
        id: 'ri_f1_1',
        targetId: 'mat_cera_1',
        type: 'material',
        name: 'Cera Vegetal de Coco T02 (Blend Coco, Palma e Arroz)',
        unit: 'g',
        quantityPerBatch: 135,
        quantityTotal: 1080,
        unitCost: 0.033,
        totalCost: 35.64,
        stockBefore: 2880,
        stockAfter: 1800,
      },
      {
        id: 'ri_f1_2',
        targetId: 'mat_ess_1',
        type: 'material',
        name: 'Essência Concentrada Lavanda Francesa & Vanilla',
        unit: 'ml',
        quantityPerBatch: 15,
        quantityTotal: 120,
        unitCost: 0.46,
        totalCost: 55.20,
        stockBefore: 370,
        stockAfter: 250,
      },
      {
        id: 'ri_f1_3',
        targetId: 'mat_pav_1',
        type: 'material',
        name: 'Pavio de Algodão Trançado Encerado com Ilhós 15cm',
        unit: 'un',
        quantityPerBatch: 1,
        quantityTotal: 8,
        unitCost: 0.48,
        totalCost: 3.84,
        stockBefore: 48,
        stockAfter: 40,
      },
      {
        id: 'ri_f1_5',
        targetId: 'mat_rec_1',
        type: 'material',
        name: 'Pote de Vidro Âmbar 200ml com Tampa de Madeira Torneada',
        unit: 'un',
        quantityPerBatch: 1,
        quantityTotal: 8,
        unitCost: 6.50,
        totalCost: 52.00,
        stockBefore: 36,
        stockAfter: 28,
      },
      {
        id: 'ri_f1_6',
        targetId: 'mat_rot_1',
        type: 'material',
        name: 'Rótulo Frontal Vinílico Fosco 6x6cm',
        unit: 'un',
        quantityPerBatch: 1,
        quantityTotal: 8,
        unitCost: 1.86,
        totalCost: 14.88,
        stockBefore: 32,
        stockAfter: 24,
      },
      {
        id: 'ri_f1_9',
        targetId: 'mat_emb_1',
        type: 'material',
        name: 'Caixa de Papelão Kraft Microondulado 10x10x10cm (Individual)',
        unit: 'un',
        quantityPerBatch: 1,
        quantityTotal: 8,
        unitCost: 2.30,
        totalCost: 18.40,
        stockBefore: 43,
        stockAfter: 35,
      }
    ],
    notes: 'Produção de 8 unidades para estoque da loja e pedidos do início do mês.',
    createdAt: '2026-09-01',
  },
  {
    id: 'prod_exec_2',
    date: '2026-09-05',
    productId: 'prod_final_2',
    productName: 'Vela Travel Tin 90g Ouro Nobre - Alecrim & Capim Limão',
    productCategory: 'Velas em Latas',
    productImageUrl: 'https://images.unsplash.com/photo-1572726729437-3732efed37c1?w=400&auto=format&fit=crop&q=80',
    isIntermediate: false,
    batchYield: 1,
    batchCount: 15,
    quantityProduced: 15,
    costPerUnit: 27.16,
    totalCost: 407.40,
    deductedItems: [
      {
        id: 'ri_f2_1',
        targetId: 'mat_cera_1',
        type: 'material',
        name: 'Cera Vegetal de Coco T02',
        unit: 'g',
        quantityPerBatch: 80,
        quantityTotal: 1200,
        unitCost: 0.033,
        totalCost: 39.60,
        stockBefore: 3000,
        stockAfter: 1800,
      },
      {
        id: 'ri_f2_2',
        targetId: 'mat_ess_3',
        type: 'material',
        name: 'Essência Concentrada Alecrim Silvestre & Capim Limão',
        unit: 'ml',
        quantityPerBatch: 9,
        quantityTotal: 135,
        unitCost: 0.44,
        totalCost: 59.40,
        stockBefore: 355,
        stockAfter: 220,
      },
      {
        id: 'ri_f2_5',
        targetId: 'mat_rec_2',
        type: 'material',
        name: 'Lata de Alumínio Travel Tin 90g Ouro Nobre',
        unit: 'un',
        quantityPerBatch: 1,
        quantityTotal: 15,
        unitCost: 3.70,
        totalCost: 55.50,
        stockBefore: 47,
        stockAfter: 32,
      },
      {
        id: 'ri_f2_6',
        targetId: 'prod_sub_4',
        type: 'product',
        name: 'Rótulo Adesivo Redondo para Tampa de Lata 6.5cm',
        unit: 'un',
        quantityPerBatch: 1,
        quantityTotal: 15,
        unitCost: 1.40,
        totalCost: 21.00,
        stockBefore: 37,
        stockAfter: 22,
      }
    ],
    notes: 'Lote de velas em latas para reposição de pronta-entrega.',
    createdAt: '2026-09-05',
  }
];

const SCHEMA_VERSION_KEY = 'atelie_schema_version';
const CURRENT_SCHEMA_VERSION = 'v5_remove_sub1_and_production_direct';

export const loadStoredData = () => {
  try {
    const version = localStorage.getItem(SCHEMA_VERSION_KEY);
    const storedMaterials = localStorage.getItem(STORAGE_KEYS.MATERIALS);
    const storedProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const storedProductions = localStorage.getItem(STORAGE_KEYS.PRODUCTIONS);
    const storedPurchases = localStorage.getItem(STORAGE_KEYS.PURCHASES);
    const storedSales = localStorage.getItem(STORAGE_KEYS.SALES);
    const storedCustomers = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    const storedPaymentMethods = localStorage.getItem(STORAGE_KEYS.PAYMENT_METHODS);
    const storedSuppliers = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
    const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);

    // Sanitize product stock (ensures currentStock and minStock exist, and removes prod_sub_1)
    const sanitizeProducts = (prods: Product[]) => {
      return prods
        .filter((p) => p.id !== 'prod_sub_1')
        .map((p) => {
          const def = DEFAULT_PRODUCTS.find((dp) => dp.id === p.id);
          const sanitizedItems = (p.items || []).map((it) => {
            if (it.targetId === 'prod_sub_1') {
              return {
                ...it,
                type: 'material' as const,
                targetId: 'mat_rot_1',
                name: 'Rótulo Frontal Vinílico Fosco 6x6cm',
              };
            }
            return it;
          });
          return {
            ...p,
            items: sanitizedItems,
            currentStock: typeof p.currentStock === 'number' ? p.currentStock : (def?.currentStock ?? 0),
            minStock: typeof p.minStock === 'number' ? p.minStock : (def?.minStock ?? 2),
          };
        });
    };

    const sanitizeProductions = (prods: Production[]) => {
      return prods.filter((p) => p.productId !== 'prod_sub_1');
    };

    // If schema is older than v5, migrate and initialize productions and stock
    if (version !== CURRENT_SCHEMA_VERSION || !storedProductions) {
      localStorage.setItem(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION);
      if (!storedMaterials) localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(DEFAULT_MATERIALS));
      
      const loadedProducts: Product[] = storedProducts ? JSON.parse(storedProducts) : DEFAULT_PRODUCTS;
      const sanitizedProducts = sanitizeProducts(loadedProducts);
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(sanitizedProducts));

      const productionsToStore: Production[] = storedProductions ? JSON.parse(storedProductions) : DEFAULT_PRODUCTIONS;
      const sanitizedProductionsList = sanitizeProductions(productionsToStore);
      localStorage.setItem(STORAGE_KEYS.PRODUCTIONS, JSON.stringify(sanitizedProductionsList));

      if (!storedPurchases) localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(DEFAULT_PURCHASES));
      
      // Update sales with default customer links if not existing
      const salesToStore = storedSales ? JSON.parse(storedSales) : DEFAULT_SALES;
      localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(salesToStore));
      
      if (!storedCustomers) localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(DEFAULT_CUSTOMERS));
      if (!storedPaymentMethods) localStorage.setItem(STORAGE_KEYS.PAYMENT_METHODS, JSON.stringify(DEFAULT_PAYMENT_METHODS));
      if (!storedSuppliers) localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(DEFAULT_SUPPLIERS));
      if (!storedSettings) localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      if (!localStorage.getItem(STORAGE_KEYS.TODOS)) localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(DEFAULT_TODOS));

      return {
        materials: storedMaterials ? JSON.parse(storedMaterials) : DEFAULT_MATERIALS,
        products: sanitizedProducts,
        productions: sanitizedProductionsList,
        purchases: storedPurchases ? JSON.parse(storedPurchases) : DEFAULT_PURCHASES,
        sales: salesToStore,
        customers: storedCustomers ? JSON.parse(storedCustomers) : DEFAULT_CUSTOMERS,
        paymentMethods: storedPaymentMethods ? JSON.parse(storedPaymentMethods) : DEFAULT_PAYMENT_METHODS,
        suppliers: storedSuppliers ? JSON.parse(storedSuppliers) : DEFAULT_SUPPLIERS,
        settings: storedSettings ? JSON.parse(storedSettings) : DEFAULT_SETTINGS,
        todos: localStorage.getItem(STORAGE_KEYS.TODOS) ? JSON.parse(localStorage.getItem(STORAGE_KEYS.TODOS)!) : DEFAULT_TODOS,
      };
    }

    const storedTodos = localStorage.getItem(STORAGE_KEYS.TODOS);
    const parsedProducts = storedProducts ? JSON.parse(storedProducts) : DEFAULT_PRODUCTS;
    const parsedProductions = storedProductions ? JSON.parse(storedProductions) : DEFAULT_PRODUCTIONS;

    return {
      materials: storedMaterials ? JSON.parse(storedMaterials) : DEFAULT_MATERIALS,
      products: sanitizeProducts(parsedProducts),
      productions: sanitizeProductions(parsedProductions),
      purchases: storedPurchases ? JSON.parse(storedPurchases) : DEFAULT_PURCHASES,
      sales: storedSales ? JSON.parse(storedSales) : DEFAULT_SALES,
      customers: storedCustomers ? JSON.parse(storedCustomers) : DEFAULT_CUSTOMERS,
      paymentMethods: storedPaymentMethods ? JSON.parse(storedPaymentMethods) : DEFAULT_PAYMENT_METHODS,
      suppliers: storedSuppliers ? JSON.parse(storedSuppliers) : DEFAULT_SUPPLIERS,
      settings: storedSettings ? JSON.parse(storedSettings) : DEFAULT_SETTINGS,
      todos: storedTodos ? JSON.parse(storedTodos) : DEFAULT_TODOS,
    };
  } catch (err) {
    console.error('Error loading data from localStorage, falling back to defaults:', err);
    return {
      materials: DEFAULT_MATERIALS,
      products: DEFAULT_PRODUCTS,
      productions: DEFAULT_PRODUCTIONS,
      purchases: DEFAULT_PURCHASES,
      sales: DEFAULT_SALES,
      customers: DEFAULT_CUSTOMERS,
      paymentMethods: DEFAULT_PAYMENT_METHODS,
      suppliers: DEFAULT_SUPPLIERS,
      settings: DEFAULT_SETTINGS,
      todos: DEFAULT_TODOS,
    };
  }
};

export const saveMaterials = (materials: Material[]) => {
  localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materials));
};

export const saveProducts = (products: Product[]) => {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
};

export const saveProductions = (productions: Production[]) => {
  localStorage.setItem(STORAGE_KEYS.PRODUCTIONS, JSON.stringify(productions));
};

export const savePurchases = (purchases: Purchase[]) => {
  localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(purchases));
};

export const saveSales = (sales: Sale[]) => {
  localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
};

export const saveCustomers = (customers: Customer[]) => {
  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
};

export const savePaymentMethods = (methods: string[]) => {
  localStorage.setItem(STORAGE_KEYS.PAYMENT_METHODS, JSON.stringify(methods));
};

export const saveSuppliers = (suppliers: Supplier[]) => {
  localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
};

export const saveSettings = (settings: AtelierSettings) => {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
};

export const saveTodos = (todos: TodoItem[]) => {
  localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(todos));
};

/**
 * Estimates the unit cost of a material.
 * Virtual atelier recipes are expanded so product pricing keeps following
 * the current cost of their real ingredients. Category ingredients use the
 * average current cost of the materials in that category as a planning estimate.
 */
export const estimateMaterialUnitCost = (
  material: Material,
  allMaterials: Material[],
  visited: Set<string> = new Set(),
  categorySelections?: Record<string, string>
): number => {
  if (!material.isMadeInAtelier || !material.recipeItems?.length || !material.batchYield) {
    return material.unitCost || 0;
  }

  if (visited.has(material.id)) return material.unitCost || 0;
  const nextVisited = new Set(visited);
  nextVisited.add(material.id);

  const recipeCost = material.recipeItems.reduce((sum, item) => {
    let unitCost = item.unitCost || 0;

    if (item.type === 'material') {
      if (item.selectionMode === 'category' && item.targetCategory) {
        const selectedId = categorySelections?.[item.id];
        const selected = selectedId
          ? allMaterials.find(
              (m) => m.id === selectedId && !m.isVirtualRecipe && m.category === item.targetCategory
            )
          : undefined;

        if (selected) {
          unitCost = selected.unitCost || 0;
        } else {
          const options = allMaterials.filter(
            (m) => !m.isVirtualRecipe && m.category === item.targetCategory
          );
          if (options.length > 0) {
            unitCost = options.reduce((acc, m) => acc + (m.unitCost || 0), 0) / options.length;
          }
        }
      } else {
        const child = allMaterials.find((m) => m.id === item.targetId);
        if (child) {
          unitCost = estimateMaterialUnitCost(child, allMaterials, nextVisited);
        }
      }
    }

    return sum + unitCost * item.quantity;
  }, 0);

  return recipeCost / Math.max(0.0001, material.batchYield);
};

/**
 * Recalculates product total cost, labor cost, suggested price and margins.
 */
export const recalculateProductPricing = (
  product: Product,
  allMaterials: Material[],
  allProducts: Product[]
): Product => {
  // Update costs of individual recipe items from current catalog
  const updatedItems: RecipeItem[] = product.items.map((item) => {
    let unitCost = item.unitCost;
    let name = item.name;

    if (item.type === 'material') {
      const mat = allMaterials.find((m) => m.id === item.targetId);
      if (mat) {
        unitCost = estimateMaterialUnitCost(mat, allMaterials, new Set(), item.categorySelections);
        name = mat.name;
      }
    } else if (item.type === 'product') {
      const subProd = allProducts.find((p) => p.id === item.targetId);
      if (subProd) {
        // Use subProd's unit cost (or unitCostFromBatch)
        unitCost = subProd.unitCostFromBatch > 0 ? subProd.unitCostFromBatch : subProd.totalCost;
        name = subProd.name;
      }
    }

    const totalCost = unitCost * item.quantity;
    return {
      ...item,
      name,
      unitCost,
      totalCost,
    };
  });

  const materialsCost = updatedItems.reduce((acc, it) => acc + (it.totalCost || 0), 0);
  const laborCost = (product.productionTimeMinutes / 60) * product.hourlyRate;
  const baseCost = materialsCost + laborCost;
  const fixedCost = baseCost * ((product.fixedCostPercent || 0) / 100);
  const otherCosts = product.otherCosts || 0;
  const totalCost = baseCost + fixedCost + otherCosts;

  const batchYield = product.batchYield > 0 ? product.batchYield : 1;
  const unitCostFromBatch = totalCost / batchYield;

  // Suggested price based on desired margin %
  // Price = TotalCost / (1 - Margin%)
  const marginFrac = Math.min(Math.max(product.profitMarginPercent, 0), 95) / 100;
  const suggestedPrice = marginFrac < 1 ? unitCostFromBatch / (1 - marginFrac) : unitCostFromBatch * 2;

  const actualPrice = product.actualPrice > 0 ? product.actualPrice : suggestedPrice;
  const netProfit = actualPrice - unitCostFromBatch;
  const calculatedMarginPercent = actualPrice > 0 ? (netProfit / actualPrice) * 100 : 0;

  return {
    ...product,
    items: updatedItems,
    materialsCost,
    laborCost,
    fixedCost,
    totalCost,
    unitCostFromBatch,
    suggestedPrice,
    actualPrice,
    netProfit,
    calculatedMarginPercent,
    updatedAt: new Date().toISOString().split('T')[0],
  };
};

/**
 * Cascades price recalculation down all products when a material or sub-product changes.
 */
export const cascadeRecalculateAllProducts = (
  materials: Material[],
  products: Product[]
): Product[] => {
  let updatedList = [...products];

  // First pass: update intermediate products (components)
  updatedList = updatedList.map((p) => {
    if (p.isIntermediate) {
      return recalculateProductPricing(p, materials, updatedList);
    }
    return p;
  });

  // Second pass: update final products (which may use intermediate products)
  updatedList = updatedList.map((p) => {
    return recalculateProductPricing(p, materials, updatedList);
  });

  return updatedList;
};

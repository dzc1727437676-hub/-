import { format, parse, getWeek, getMonth, getYear } from 'date-fns';

export interface OrderData {
  [key: string]: any;
}

export interface MSKUMapping {
  id?: number;
  msku: string;
  platform_zh: string;
  category1: string;
  category2: string;
  attr_name: string;
  product_type: string;
}

export interface PlatformMapping {
  id?: number;
  source_platform: string;
  platform_zh: string;
}

export const processData = (
  rawData: OrderData[],
  mskuMappings: MSKUMapping[],
  platformMappings: PlatformMapping[]
) => {
  const platformMap = new Map(platformMappings.map(m => [m.source_platform.trim(), m.platform_zh.trim()]));
  const mskuMap = new Map(mskuMappings.map(m => [`${m.msku.trim()}|${m.platform_zh.trim()}`, m]));

  return rawData.map(row => {
    // Robust column detection
    const getVal = (keys: string[]) => {
      for (const key of keys) {
        if (row[key] !== undefined) return String(row[key]).trim();
      }
      return '';
    };

    const sourcePlatform = getVal(['平台', 'Platform', '源平台', 'Source Platform']);
    const platformZh = platformMap.get(sourcePlatform) || sourcePlatform;
    
    const msku = getVal(['MSKU', 'msku', 'Msku', '商家编码']);
    const orderId = getVal(['订单号', '订单编号', 'Order ID', 'Order Number', 'Order No']);
    const mapping = mskuMap.get(`${msku}|${platformZh}`);

    // Sales Amount (销售额)
    const salesStr = getVal(['成交金额', '销售额', '订单金额', 'Sales', 'Amount']);
    const sales = parseFloat(salesStr.replace(/,/g, '').replace(/[^0-9.]/g, '')) || 0;
    
    // Sales Volume (销量)
    const qtyStr = getVal(['数量', '成交数量', '销量', 'Quantity', 'Qty']);
    const quantity = parseFloat(qtyStr.replace(/,/g, '').replace(/[^0-9.]/g, '')) || 0;

    // Order Count (订单量)
    const ordersStr = getVal(['订单量', '订单数', '成交订单数', 'Orders', 'Order Count']);
    const orders = parseFloat(ordersStr.replace(/,/g, '').replace(/[^0-9.]/g, '')) || 0;

    // Date processing
    let dateStr = getVal(['时间', 'Time', 'Date', '日期', '付款时间']);
    let yearWeek = '';
    let yearMonth = '';
    let formattedDate = '';
    
    if (dateStr) {
      try {
        // Handle multiple formats: 2026-03-04 or 2026/03/11
        const cleanDateStr = dateStr.replace(/\//g, '-');
        const date = new Date(cleanDateStr);
        if (!isNaN(date.getTime())) {
          const year = getYear(date);
          const month = getMonth(date) + 1;
          const week = getWeek(date);
          yearWeek = `${year}-W${week.toString().padStart(2, '0')}`;
          yearMonth = `${year}-${month.toString().padStart(2, '0')}`;
          formattedDate = format(date, 'yyyy-MM-dd');
        }
      } catch (e) {
        console.error('Date parsing error:', e);
      }
    }

    return {
      ...row,
      '中文平台': platformZh,
      '一级品类': mapping?.category1 || '',
      '二级品类': mapping?.category2 || '',
      '销售属性名称': mapping?.attr_name || '',
      '产品类型': mapping?.product_type || '',
      '年-周数': yearWeek,
      '年-月份': yearMonth,
      '日期': formattedDate,
      '销售额': sales,
      '销量': quantity,
      '订单量': orders,
      '_isMapped': !!mapping,
      'MSKU': msku,
      '订单号': orderId,
    };
  });
};

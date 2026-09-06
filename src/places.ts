/**
 * Birthplaces.
 *
 * Longitude is the reason this list exists. It drives the 真太阳时 correction,
 * and that correction is large — Singapore runs about −65 minutes against its
 * own clock. Picking "close enough" city is fine; picking the wrong country is
 * not, so the list is broad rather than convenient.
 *
 * Two notes on the time zones, both of which are real traps:
 *
 *  - Xinjiang. The tz database has Asia/Urumqi at UTC+6, but Chinese civil
 *    records — including birth certificates — are written in Beijing time.
 *    A birth "at 07:00" in Ürümqi means 07:00 Beijing time on the document, so
 *    these use Asia/Shanghai. The 87°E longitude then does the real work: the
 *    true-solar correction comes out near −130 minutes, which is correct and
 *    which a naive +8 assumption would lose entirely.
 *  - Historical offsets are handled by the engine from the IANA database, so
 *    Singapore and Malaysia before 1982, Japan's 1948–51 DST, and China's
 *    1986–91 DST all resolve without anything special here.
 *
 * Longitudes are city-centre, to two decimals — about a kilometre, or four
 * seconds of solar time. Far below the precision anyone's stated birth minute
 * actually has.
 */

export interface Place {
  readonly zh: string;
  readonly en: string;
  readonly tz: string;
  readonly lon: number;
  /** Grouping label, and extra search terms. */
  readonly region: { readonly zh: string; readonly en: string };
}

const R = {
  sg: { zh: '新加坡', en: 'Singapore' },
  my: { zh: '马来西亚', en: 'Malaysia' },
  cn: { zh: '中国大陆', en: 'Mainland China' },
  hk: { zh: '港澳', en: 'Hong Kong & Macau' },
  tw: { zh: '台湾', en: 'Taiwan' },
  jp: { zh: '日本', en: 'Japan' },
  kr: { zh: '韩国', en: 'South Korea' },
  sea: { zh: '东南亚', en: 'Southeast Asia' },
  sa: { zh: '南亚', en: 'South Asia' },
  au: { zh: '澳洲纽西兰', en: 'Australia & NZ' },
  eu: { zh: '欧洲', en: 'Europe' },
  am: { zh: '美洲', en: 'Americas' },
  me: { zh: '中东非洲', en: 'Middle East & Africa' },
} as const;

export const PLACES: readonly Place[] = [
  // Singapore & Malaysia — both moved from +07:30 to +08:00 on 1982-01-01.
  { zh: '新加坡', en: 'Singapore', tz: 'Asia/Singapore', lon: 103.82, region: R.sg },
  { zh: '吉隆坡', en: 'Kuala Lumpur', tz: 'Asia/Kuala_Lumpur', lon: 101.69, region: R.my },
  { zh: '槟城', en: 'Penang', tz: 'Asia/Kuala_Lumpur', lon: 100.33, region: R.my },
  { zh: '新山', en: 'Johor Bahru', tz: 'Asia/Kuala_Lumpur', lon: 103.76, region: R.my },
  { zh: '怡保', en: 'Ipoh', tz: 'Asia/Kuala_Lumpur', lon: 101.08, region: R.my },
  { zh: '马六甲', en: 'Malacca', tz: 'Asia/Kuala_Lumpur', lon: 102.25, region: R.my },
  { zh: '古晋', en: 'Kuching', tz: 'Asia/Kuching', lon: 110.34, region: R.my },
  { zh: '亚庇', en: 'Kota Kinabalu', tz: 'Asia/Kuching', lon: 116.07, region: R.my },

  // Mainland China. All on Beijing time by law, which is the point of the
  // longitude column — Ürümqi and Shanghai share a clock and 34° of sky.
  { zh: '北京', en: 'Beijing', tz: 'Asia/Shanghai', lon: 116.41, region: R.cn },
  { zh: '上海', en: 'Shanghai', tz: 'Asia/Shanghai', lon: 121.47, region: R.cn },
  { zh: '广州', en: 'Guangzhou', tz: 'Asia/Shanghai', lon: 113.26, region: R.cn },
  { zh: '深圳', en: 'Shenzhen', tz: 'Asia/Shanghai', lon: 114.06, region: R.cn },
  { zh: '成都', en: 'Chengdu', tz: 'Asia/Shanghai', lon: 104.07, region: R.cn },
  { zh: '重庆', en: 'Chongqing', tz: 'Asia/Shanghai', lon: 106.55, region: R.cn },
  { zh: '武汉', en: 'Wuhan', tz: 'Asia/Shanghai', lon: 114.30, region: R.cn },
  { zh: '西安', en: "Xi'an", tz: 'Asia/Shanghai', lon: 108.94, region: R.cn },
  { zh: '杭州', en: 'Hangzhou', tz: 'Asia/Shanghai', lon: 120.16, region: R.cn },
  { zh: '南京', en: 'Nanjing', tz: 'Asia/Shanghai', lon: 118.80, region: R.cn },
  { zh: '天津', en: 'Tianjin', tz: 'Asia/Shanghai', lon: 117.20, region: R.cn },
  { zh: '苏州', en: 'Suzhou', tz: 'Asia/Shanghai', lon: 120.59, region: R.cn },
  { zh: '青岛', en: 'Qingdao', tz: 'Asia/Shanghai', lon: 120.38, region: R.cn },
  { zh: '沈阳', en: 'Shenyang', tz: 'Asia/Shanghai', lon: 123.43, region: R.cn },
  { zh: '哈尔滨', en: 'Harbin', tz: 'Asia/Shanghai', lon: 126.53, region: R.cn },
  { zh: '大连', en: 'Dalian', tz: 'Asia/Shanghai', lon: 121.62, region: R.cn },
  { zh: '厦门', en: 'Xiamen', tz: 'Asia/Shanghai', lon: 118.09, region: R.cn },
  { zh: '福州', en: 'Fuzhou', tz: 'Asia/Shanghai', lon: 119.30, region: R.cn },
  { zh: '长沙', en: 'Changsha', tz: 'Asia/Shanghai', lon: 112.94, region: R.cn },
  { zh: '郑州', en: 'Zhengzhou', tz: 'Asia/Shanghai', lon: 113.63, region: R.cn },
  { zh: '济南', en: 'Jinan', tz: 'Asia/Shanghai', lon: 117.00, region: R.cn },
  { zh: '昆明', en: 'Kunming', tz: 'Asia/Shanghai', lon: 102.83, region: R.cn },
  { zh: '贵阳', en: 'Guiyang', tz: 'Asia/Shanghai', lon: 106.63, region: R.cn },
  { zh: '南宁', en: 'Nanning', tz: 'Asia/Shanghai', lon: 108.37, region: R.cn },
  { zh: '兰州', en: 'Lanzhou', tz: 'Asia/Shanghai', lon: 103.83, region: R.cn },
  { zh: '汕头', en: 'Shantou', tz: 'Asia/Shanghai', lon: 116.68, region: R.cn },
  { zh: '海口', en: 'Haikou', tz: 'Asia/Shanghai', lon: 110.20, region: R.cn },
  { zh: '乌鲁木齐', en: 'Ürümqi', tz: 'Asia/Shanghai', lon: 87.62, region: R.cn },
  { zh: '拉萨', en: 'Lhasa', tz: 'Asia/Shanghai', lon: 91.11, region: R.cn },

  { zh: '香港', en: 'Hong Kong', tz: 'Asia/Hong_Kong', lon: 114.17, region: R.hk },
  { zh: '澳门', en: 'Macau', tz: 'Asia/Macau', lon: 113.54, region: R.hk },

  { zh: '台北', en: 'Taipei', tz: 'Asia/Taipei', lon: 121.56, region: R.tw },
  { zh: '台中', en: 'Taichung', tz: 'Asia/Taipei', lon: 120.68, region: R.tw },
  { zh: '高雄', en: 'Kaohsiung', tz: 'Asia/Taipei', lon: 120.30, region: R.tw },
  { zh: '台南', en: 'Tainan', tz: 'Asia/Taipei', lon: 120.21, region: R.tw },
  { zh: '新竹', en: 'Hsinchu', tz: 'Asia/Taipei', lon: 120.97, region: R.tw },
  { zh: '花莲', en: 'Hualien', tz: 'Asia/Taipei', lon: 121.60, region: R.tw },

  // Japan. On UTC+9, whose meridian is 135°E — so unusually for East Asia the
  // true-solar correction here is small, and positive east of Akashi.
  { zh: '东京', en: 'Tokyo', tz: 'Asia/Tokyo', lon: 139.69, region: R.jp },
  { zh: '大阪', en: 'Osaka', tz: 'Asia/Tokyo', lon: 135.50, region: R.jp },
  { zh: '京都', en: 'Kyoto', tz: 'Asia/Tokyo', lon: 135.77, region: R.jp },
  { zh: '名古屋', en: 'Nagoya', tz: 'Asia/Tokyo', lon: 136.91, region: R.jp },
  { zh: '岐阜', en: 'Gifu', tz: 'Asia/Tokyo', lon: 136.76, region: R.jp },
  { zh: '横滨', en: 'Yokohama', tz: 'Asia/Tokyo', lon: 139.64, region: R.jp },
  { zh: '神户', en: 'Kobe', tz: 'Asia/Tokyo', lon: 135.20, region: R.jp },
  { zh: '札幌', en: 'Sapporo', tz: 'Asia/Tokyo', lon: 141.35, region: R.jp },
  { zh: '福冈', en: 'Fukuoka', tz: 'Asia/Tokyo', lon: 130.40, region: R.jp },
  { zh: '广岛', en: 'Hiroshima', tz: 'Asia/Tokyo', lon: 132.46, region: R.jp },
  { zh: '仙台', en: 'Sendai', tz: 'Asia/Tokyo', lon: 140.87, region: R.jp },
  { zh: '金泽', en: 'Kanazawa', tz: 'Asia/Tokyo', lon: 136.63, region: R.jp },
  { zh: '那霸', en: 'Naha', tz: 'Asia/Tokyo', lon: 127.68, region: R.jp },

  { zh: '首尔', en: 'Seoul', tz: 'Asia/Seoul', lon: 126.98, region: R.kr },
  { zh: '釜山', en: 'Busan', tz: 'Asia/Seoul', lon: 129.08, region: R.kr },
  { zh: '仁川', en: 'Incheon', tz: 'Asia/Seoul', lon: 126.71, region: R.kr },

  { zh: '雅加达', en: 'Jakarta', tz: 'Asia/Jakarta', lon: 106.85, region: R.sea },
  { zh: '泗水', en: 'Surabaya', tz: 'Asia/Jakarta', lon: 112.75, region: R.sea },
  { zh: '万隆', en: 'Bandung', tz: 'Asia/Jakarta', lon: 107.62, region: R.sea },
  { zh: '棉兰', en: 'Medan', tz: 'Asia/Jakarta', lon: 98.67, region: R.sea },
  { zh: '巴厘岛', en: 'Bali (Denpasar)', tz: 'Asia/Makassar', lon: 115.22, region: R.sea },
  { zh: '曼谷', en: 'Bangkok', tz: 'Asia/Bangkok', lon: 100.50, region: R.sea },
  { zh: '清迈', en: 'Chiang Mai', tz: 'Asia/Bangkok', lon: 98.98, region: R.sea },
  { zh: '普吉', en: 'Phuket', tz: 'Asia/Bangkok', lon: 98.39, region: R.sea },
  { zh: '河内', en: 'Hanoi', tz: 'Asia/Ho_Chi_Minh', lon: 105.85, region: R.sea },
  { zh: '胡志明市', en: 'Ho Chi Minh City', tz: 'Asia/Ho_Chi_Minh', lon: 106.63, region: R.sea },
  { zh: '马尼拉', en: 'Manila', tz: 'Asia/Manila', lon: 120.98, region: R.sea },
  { zh: '宿务', en: 'Cebu', tz: 'Asia/Manila', lon: 123.89, region: R.sea },
  { zh: '金边', en: 'Phnom Penh', tz: 'Asia/Phnom_Penh', lon: 104.92, region: R.sea },
  { zh: '仰光', en: 'Yangon', tz: 'Asia/Yangon', lon: 96.20, region: R.sea },
  { zh: '万象', en: 'Vientiane', tz: 'Asia/Vientiane', lon: 102.60, region: R.sea },
  { zh: '斯里巴加湾', en: 'Bandar Seri Begawan', tz: 'Asia/Brunei', lon: 114.94, region: R.sea },

  { zh: '孟买', en: 'Mumbai', tz: 'Asia/Kolkata', lon: 72.88, region: R.sa },
  { zh: '新德里', en: 'New Delhi', tz: 'Asia/Kolkata', lon: 77.21, region: R.sa },
  { zh: '班加罗尔', en: 'Bangalore', tz: 'Asia/Kolkata', lon: 77.59, region: R.sa },
  { zh: '金奈', en: 'Chennai', tz: 'Asia/Kolkata', lon: 80.27, region: R.sa },
  { zh: '加尔各答', en: 'Kolkata', tz: 'Asia/Kolkata', lon: 88.36, region: R.sa },
  { zh: '科伦坡', en: 'Colombo', tz: 'Asia/Colombo', lon: 79.86, region: R.sa },
  { zh: '达卡', en: 'Dhaka', tz: 'Asia/Dhaka', lon: 90.41, region: R.sa },
  { zh: '加德满都', en: 'Kathmandu', tz: 'Asia/Kathmandu', lon: 85.32, region: R.sa },

  { zh: '悉尼', en: 'Sydney', tz: 'Australia/Sydney', lon: 151.21, region: R.au },
  { zh: '墨尔本', en: 'Melbourne', tz: 'Australia/Melbourne', lon: 144.96, region: R.au },
  { zh: '布里斯班', en: 'Brisbane', tz: 'Australia/Brisbane', lon: 153.03, region: R.au },
  { zh: '珀斯', en: 'Perth', tz: 'Australia/Perth', lon: 115.86, region: R.au },
  { zh: '阿德莱德', en: 'Adelaide', tz: 'Australia/Adelaide', lon: 138.60, region: R.au },
  { zh: '奥克兰', en: 'Auckland', tz: 'Pacific/Auckland', lon: 174.76, region: R.au },
  { zh: '惠灵顿', en: 'Wellington', tz: 'Pacific/Auckland', lon: 174.78, region: R.au },

  { zh: '伦敦', en: 'London', tz: 'Europe/London', lon: -0.13, region: R.eu },
  { zh: '曼彻斯特', en: 'Manchester', tz: 'Europe/London', lon: -2.24, region: R.eu },
  { zh: '都柏林', en: 'Dublin', tz: 'Europe/Dublin', lon: -6.26, region: R.eu },
  { zh: '巴黎', en: 'Paris', tz: 'Europe/Paris', lon: 2.35, region: R.eu },
  { zh: '柏林', en: 'Berlin', tz: 'Europe/Berlin', lon: 13.40, region: R.eu },
  { zh: '阿姆斯特丹', en: 'Amsterdam', tz: 'Europe/Amsterdam', lon: 4.90, region: R.eu },
  { zh: '苏黎世', en: 'Zurich', tz: 'Europe/Zurich', lon: 8.54, region: R.eu },
  { zh: '罗马', en: 'Rome', tz: 'Europe/Rome', lon: 12.50, region: R.eu },
  { zh: '马德里', en: 'Madrid', tz: 'Europe/Madrid', lon: -3.70, region: R.eu },
  { zh: '巴塞罗那', en: 'Barcelona', tz: 'Europe/Madrid', lon: 2.17, region: R.eu },
  { zh: '斯德哥尔摩', en: 'Stockholm', tz: 'Europe/Stockholm', lon: 18.07, region: R.eu },
  { zh: '莫斯科', en: 'Moscow', tz: 'Europe/Moscow', lon: 37.62, region: R.eu },
  { zh: '伊斯坦布尔', en: 'Istanbul', tz: 'Europe/Istanbul', lon: 28.98, region: R.eu },

  { zh: '纽约', en: 'New York', tz: 'America/New_York', lon: -74.01, region: R.am },
  { zh: '波士顿', en: 'Boston', tz: 'America/New_York', lon: -71.06, region: R.am },
  { zh: '华盛顿', en: 'Washington DC', tz: 'America/New_York', lon: -77.04, region: R.am },
  { zh: '芝加哥', en: 'Chicago', tz: 'America/Chicago', lon: -87.63, region: R.am },
  { zh: '休斯敦', en: 'Houston', tz: 'America/Chicago', lon: -95.37, region: R.am },
  { zh: '丹佛', en: 'Denver', tz: 'America/Denver', lon: -104.99, region: R.am },
  { zh: '洛杉矶', en: 'Los Angeles', tz: 'America/Los_Angeles', lon: -118.24, region: R.am },
  { zh: '旧金山', en: 'San Francisco', tz: 'America/Los_Angeles', lon: -122.42, region: R.am },
  { zh: '西雅图', en: 'Seattle', tz: 'America/Los_Angeles', lon: -122.33, region: R.am },
  { zh: '多伦多', en: 'Toronto', tz: 'America/Toronto', lon: -79.38, region: R.am },
  { zh: '温哥华', en: 'Vancouver', tz: 'America/Vancouver', lon: -123.12, region: R.am },
  { zh: '墨西哥城', en: 'Mexico City', tz: 'America/Mexico_City', lon: -99.13, region: R.am },
  { zh: '圣保罗', en: 'São Paulo', tz: 'America/Sao_Paulo', lon: -46.63, region: R.am },
  { zh: '布宜诺斯艾利斯', en: 'Buenos Aires', tz: 'America/Argentina/Buenos_Aires', lon: -58.38, region: R.am },

  { zh: '迪拜', en: 'Dubai', tz: 'Asia/Dubai', lon: 55.27, region: R.me },
  { zh: '多哈', en: 'Doha', tz: 'Asia/Qatar', lon: 51.53, region: R.me },
  { zh: '利雅得', en: 'Riyadh', tz: 'Asia/Riyadh', lon: 46.72, region: R.me },
  { zh: '特拉维夫', en: 'Tel Aviv', tz: 'Asia/Jerusalem', lon: 34.78, region: R.me },
  { zh: '开罗', en: 'Cairo', tz: 'Africa/Cairo', lon: 31.24, region: R.me },
  { zh: '约翰内斯堡', en: 'Johannesburg', tz: 'Africa/Johannesburg', lon: 28.05, region: R.me },
  { zh: '内罗毕', en: 'Nairobi', tz: 'Africa/Nairobi', lon: 36.82, region: R.me },
  { zh: '拉各斯', en: 'Lagos', tz: 'Africa/Lagos', lon: 3.38, region: R.me },
];

/** Index of the default selection, by name rather than a magic number. */
export const DEFAULT_PLACE = Math.max(0, PLACES.findIndex((p) => p.en === 'Singapore'));

/**
 * Filter by a typed query.
 *
 * Matches the city in either language, the region, and the IANA zone — so
 * "japan", "日本", "gifu", "岐阜" and "Asia/Tokyo" all reach the same row.
 * Prefix matches sort first so typing "sing" puts Singapore above Kota
 * Kinabalu, which merely contains an "s".
 */
export function searchPlaces(query: string, limit = 60): Place[] {
  const q = query.trim().toLowerCase();
  if (!q) return PLACES.slice(0, limit);

  const scored: { place: Place; score: number }[] = [];
  for (const p of PLACES) {
    const fields = [p.en.toLowerCase(), p.zh, p.region.en.toLowerCase(), p.region.zh, p.tz.toLowerCase()];
    let best = 0;
    for (const [i, f] of fields.entries()) {
      if (!f.includes(q)) continue;
      // City name beats region beats zone; a prefix beats a substring.
      const fieldWeight = i < 2 ? 3 : i < 4 ? 2 : 1;
      best = Math.max(best, fieldWeight * (f.startsWith(q) ? 2 : 1));
    }
    if (best > 0) scored.push({ place: p, score: best });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.place.en.localeCompare(b.place.en))
    .slice(0, limit)
    .map((s) => s.place);
}

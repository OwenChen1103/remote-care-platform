/**
 * Taiwan city/county + district list for service request forms (PDF p4 / p5).
 *
 * Used by exercise_program + home_cleaning categories where PDF specifies
 * separate 縣市 / 區域 dropdowns (not a single free-text address).
 *
 * Coverage: all 22 administrative divisions (6 直轄市 + 3 市 + 13 縣).
 *   - For 直轄市 (台北/新北/etc): all districts listed
 *   - For 市 (基隆/新竹市/嘉義市): all districts listed (≤ 7 each)
 *   - For 縣 with many townships (彰化/雲林/etc): top ~10 by population + 「其他」
 *
 * The 「其他」 entry pairs with the form's free-text 詳細地址 field as fallback.
 *
 * Future: replace with API-backed list if we need authoritative coverage,
 * postcodes, or geocoding.
 */
export interface TaiwanRegion {
  city: string;
  districts: readonly string[];
}

export const TW_REGIONS: readonly TaiwanRegion[] = [
  // ── 6 直轄市 ──
  {
    city: '台北市',
    districts: [
      '中正區', '大同區', '中山區', '松山區', '大安區', '萬華區',
      '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區',
    ],
  },
  {
    city: '新北市',
    districts: [
      '板橋區', '三重區', '中和區', '永和區', '新莊區', '新店區',
      '土城區', '蘆洲區', '汐止區', '樹林區', '林口區', '淡水區',
      '三峽區', '鶯歌區', '泰山區', '五股區', '八里區', '其他',
    ],
  },
  {
    city: '桃園市',
    districts: [
      '桃園區', '中壢區', '平鎮區', '八德區', '楊梅區', '龜山區',
      '龍潭區', '蘆竹區', '大溪區', '大園區', '其他',
    ],
  },
  {
    city: '台中市',
    districts: [
      '中區', '東區', '南區', '西區', '北區',
      '北屯區', '南屯區', '西屯區', '太平區', '大里區',
      '霧峰區', '烏日區', '豐原區', '后里區', '其他',
    ],
  },
  {
    city: '台南市',
    districts: [
      '東區', '南區', '北區', '中西區', '安南區', '安平區',
      '永康區', '歸仁區', '新化區', '善化區', '麻豆區', '其他',
    ],
  },
  {
    city: '高雄市',
    districts: [
      '新興區', '前金區', '苓雅區', '鹽埕區', '鼓山區', '三民區',
      '左營區', '楠梓區', '小港區', '前鎮區', '旗津區', '鳳山區',
      '林園區', '大寮區', '岡山區', '其他',
    ],
  },

  // ── 3 市 (省轄市等級) ──
  {
    city: '基隆市',
    districts: ['中正區', '七堵區', '暖暖區', '仁愛區', '中山區', '安樂區', '信義區'],
  },
  {
    city: '新竹市',
    districts: ['北區', '東區', '香山區'],
  },
  {
    city: '嘉義市',
    districts: ['東區', '西區'],
  },

  // ── 13 縣 ──
  {
    city: '新竹縣',
    districts: [
      '竹北市', '竹東鎮', '新埔鎮', '關西鎮', '湖口鄉',
      '新豐鄉', '芎林鄉', '橫山鄉', '其他',
    ],
  },
  {
    city: '苗栗縣',
    districts: [
      '苗栗市', '頭份市', '竹南鎮', '後龍鎮', '通霄鎮',
      '苑裡鎮', '卓蘭鎮', '公館鄉', '銅鑼鄉', '其他',
    ],
  },
  {
    city: '彰化縣',
    districts: [
      '彰化市', '員林市', '鹿港鎮', '和美鎮', '北斗鎮',
      '溪湖鎮', '田中鎮', '二林鎮', '花壇鄉', '其他',
    ],
  },
  {
    city: '南投縣',
    districts: [
      '南投市', '草屯鎮', '埔里鎮', '竹山鎮', '集集鎮',
      '名間鄉', '魚池鄉', '仁愛鄉', '其他',
    ],
  },
  {
    city: '雲林縣',
    districts: [
      '斗六市', '虎尾鎮', '西螺鎮', '北港鎮', '斗南鎮',
      '土庫鎮', '林內鄉', '麥寮鄉', '其他',
    ],
  },
  {
    city: '嘉義縣',
    districts: [
      '太保市', '朴子市', '布袋鎮', '大林鎮', '民雄鄉',
      '溪口鄉', '新港鄉', '六腳鄉', '東石鄉', '其他',
    ],
  },
  {
    city: '屏東縣',
    districts: [
      '屏東市', '潮州鎮', '東港鎮', '恆春鎮', '萬丹鄉',
      '長治鄉', '麟洛鄉', '九如鄉', '里港鄉', '其他',
    ],
  },
  {
    city: '宜蘭縣',
    districts: [
      '宜蘭市', '羅東鎮', '蘇澳鎮', '頭城鎮', '礁溪鄉',
      '壯圍鄉', '員山鄉', '冬山鄉', '五結鄉', '其他',
    ],
  },
  {
    city: '花蓮縣',
    districts: [
      '花蓮市', '吉安鄉', '新城鄉', '玉里鎮', '鳳林鎮',
      '光復鄉', '壽豐鄉', '瑞穗鄉', '其他',
    ],
  },
  {
    city: '台東縣',
    districts: [
      '台東市', '成功鎮', '關山鎮', '卑南鄉', '鹿野鄉',
      '池上鄉', '東河鄉', '長濱鄉', '其他',
    ],
  },
  {
    city: '澎湖縣',
    districts: ['馬公市', '湖西鄉', '白沙鄉', '西嶼鄉', '望安鄉', '七美鄉'],
  },
  {
    city: '金門縣',
    districts: ['金城鎮', '金沙鎮', '金湖鎮', '金寧鄉', '烈嶼鄉', '烏坵鄉'],
  },
  {
    city: '連江縣',
    districts: ['南竿鄉', '北竿鄉', '莒光鄉', '東引鄉'],
  },
] as const;

/**
 * Compose city + district + detailed address into a single human-readable location string.
 * Empty parts are skipped so we never produce `"  number"` or trailing spaces.
 */
export function composeLocation(city: string, district: string, detail: string): string {
  return [city.trim(), district.trim(), detail.trim()].filter(Boolean).join(' ');
}

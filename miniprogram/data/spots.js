/**
 * 浪点本地数据
 * 中国沿海冲浪点，前端直接引用，无需后端
 */
const SPOTS = [
  // ── 广东 ──
  {
    id: 'shenzhen-dongchong', name: '东涌海滩', region: '广东深圳',
    lat: 22.464, lon: 114.542,
    description: '未过度开发，沙质细腻，四季可浪',
  },
  {
    id: 'shenzhen-xichong', name: '西涌海滩', region: '广东深圳',
    lat: 22.48, lon: 114.543,
    description: '深圳最长海滩（4.5km），全国八大最美海滩之一',
  },
  {
    id: 'huizhou-loop', name: 'LOOP', region: '广东惠州',
    lat: 22.59, lon: 114.905,
    description: '虹海湾东湾LOOP冲浪沙龙附近海岸',
  },
  {
    id: 'huizhou-gaoyangwei', name: '高洋尾', region: '广东惠州',
    lat: 22.65, lon: 114.94,
    description: '港口镇南侧东向海滩',
  },
  {
    id: 'huizhou-qingrendao', name: '情人岛', region: '广东惠州',
    lat: 22.64, lon: 114.93,
    description: '平海镇黑排角情人岛',
  },
  {
    id: 'huizhou-honghaiwan', name: '山海里', region: '广东惠州',
    lat: 22.61, lon: 114.91,
    description: '惠州山海里',
  },
  {
    id: 'huizhou-wanke', name: '万科一期', region: '广东惠州',
    lat: 22.60, lon: 114.89,
    description: '万科双月湾一期（Lunas Del Mar）',
  },
  {
    id: 'huizhou-shizidao', name: '狮子岛', region: '广东惠州',
    lat: 22.598, lon: 114.842,
    description: '纬度与夏威夷相同，日落美景出众',
  },
  {
    id: 'huizhou-tiancheng', name: '甜橙', region: '广东惠州',
    lat: 22.61, lon: 114.91,
    description: '双月湾东湾甜橙冲浪俱乐部',
  },
  {
    id: 'shanwei-honghaiwan', name: '红海湾（遮浪半岛）', region: '广东汕尾',
    lat: 22.67, lon: 115.57,
    description: '中国观浪第一湾，冬季浪高1-2m',
  },
  {
    id: 'shantou-nanshanwan', name: '南山湾', region: '广东汕头',
    lat: 23.244, lon: 116.734,
    description: '原始海滩风貌，玻璃海水质',
  },
  {
    id: 'maoming-langmanhaian', name: '浪漫海岸', region: '广东茂名',
    lat: 21.463, lon: 111.142,
    description: '5.3km私家海岸，国家4A景区',
  },
  {
    id: 'zhanjiang-longhaitian', name: '龙海天（东海岛）', region: '广东湛江',
    lat: 21.03, lon: 110.48,
    description: '中国第一长滩（28km），世界第二',
  },
  {
    id: 'yangjiang-dajiaowan', name: '大角湾', region: '广东阳江',
    lat: 21.57, lon: 111.846,
    description: '国家5A景区，广东首个滨海5A',
  },
  {
    id: 'yangjiang-fuhuling', name: '福湖岭（月亮湾）', region: '广东阳江',
    lat: 21.48, lon: 111.6,
    description: '天然礁石海滩，8km蜿蜒海岸',
  },
  // ── 海南 ──
  {
    id: 'sanya-houhai', name: '后海（皇后湾）', region: '海南三亚',
    lat: 18.263, lon: 109.718,
    description: '中国冲浪第一村，全年浪稳，新手圣地',
  },
  {
    id: 'wanning-riyuewan', name: '日月湾', region: '海南万宁',
    lat: 18.617, lon: 110.198,
    description: '国家冲浪基地，国家级赛事举办地',
  },
  {
    id: 'wanning-shimeiwan', name: '石梅湾', region: '海南万宁',
    lat: 18.669, lon: 110.288,
    description: '海南最美海湾，世界级青皮林保护区',
  },
  {
    id: 'wanning-shenzhoubandao', name: '神州半岛', region: '海南万宁',
    lat: 18.8, lon: 110.39,
    description: '缓坡长浪，适合家庭亲子体验',
  },
  {
    id: 'lingshui-qingshuiwan', name: '清水湾', region: '海南陵水',
    lat: 18.404, lon: 109.854,
    description: '会唱歌的沙滩，12km海岸线',
  },
  {
    id: 'lingshui-xiangshuiwan', name: '香水湾（富力湾）', region: '海南陵水',
    lat: 18.531, lon: 110.101,
    description: '4.2km私属海岸，北纬18度黄金度假带',
  },
];

/**
 * 获取所有浪点
 */
function getAllSpots() {
  return SPOTS;
}

/**
 * 按关键字搜索浪点（名称或地区）
 */
function searchSpots(keyword) {
  return SPOTS.filter(function (s) {
    return s.name.indexOf(keyword) !== -1 || s.region.indexOf(keyword) !== -1 || s.id.indexOf(keyword.toLowerCase()) !== -1;
  });
}

/**
 * 按区域筛选浪点
 */
function getSpotsByRegion(region) {
  if (!region) return SPOTS;
  return SPOTS.filter(function (s) { return s.region === region; });
}

/**
 * 获取所有区域列表
 */
function getRegions() {
  var set = {};
  SPOTS.forEach(function (s) { set[s.region] = true; });
  return Object.keys(set).sort();
}

/**
 * 根据 ID 获取单个浪点
 */
function getSpotById(id) {
  for (var i = 0; i < SPOTS.length; i++) {
    if (SPOTS[i].id === id) return SPOTS[i];
  }
  return null;
}

module.exports = {
  SPOTS: SPOTS,
  getAllSpots: getAllSpots,
  searchSpots: searchSpots,
  getSpotsByRegion: getSpotsByRegion,
  getRegions: getRegions,
  getSpotById: getSpotById,
};

// Singapore area data for seeding the database
// Based on Singapore's 28 districts and their postal codes

export interface SingaporeAreaData {
  name: string;
  district: string;
  postalCodes: string[];
  latitude: number;
  longitude: number;
  boundaries: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  mrtProximity: number;
  cbdDistance: number;
  amenityScore: number;
}

export const singaporeAreas: SingaporeAreaData[] = [
  // District 1 - Boat Quay, Raffles Place, Marina
  {
    name: "Raffles Place",
    district: "District 1",
    postalCodes: ["018989", "048624", "049318", "049319", "049320"],
    latitude: 1.2844,
    longitude: 103.8517,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8480, 1.2800], [103.8550, 1.2800], [103.8550, 1.2880], [103.8480, 1.2880], [103.8480, 1.2800]]]
    },
    mrtProximity: 0.1,
    cbdDistance: 0.0,
    amenityScore: 9.5
  },
  {
    name: "Marina Bay",
    district: "District 1",
    postalCodes: ["018956", "018957", "018958", "018959", "018960"],
    latitude: 1.2820,
    longitude: 103.8607,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8570, 1.2780], [103.8640, 1.2780], [103.8640, 1.2860], [103.8570, 1.2860], [103.8570, 1.2780]]]
    },
    mrtProximity: 0.2,
    cbdDistance: 0.5,
    amenityScore: 9.8
  },

  // District 2 - Anson, Tanjong Pagar
  {
    name: "Tanjong Pagar",
    district: "District 2",
    postalCodes: ["088001", "088002", "088003", "089001", "089002"],
    latitude: 1.2762,
    longitude: 103.8458,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8420, 1.2720], [103.8490, 1.2720], [103.8490, 1.2800], [103.8420, 1.2800], [103.8420, 1.2720]]]
    },
    mrtProximity: 0.1,
    cbdDistance: 1.2,
    amenityScore: 8.5
  },

  // District 3 - Queenstown, Tiong Bahru
  {
    name: "Tiong Bahru",
    district: "District 3",
    postalCodes: ["160001", "160002", "160003", "161001", "161002"],
    latitude: 1.2859,
    longitude: 103.8268,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8230, 1.2820], [103.8300, 1.2820], [103.8300, 1.2900], [103.8230, 1.2900], [103.8230, 1.2820]]]
    },
    mrtProximity: 0.2,
    cbdDistance: 2.5,
    amenityScore: 8.2
  },
  {
    name: "Queenstown",
    district: "District 3",
    postalCodes: ["118001", "118002", "118003", "119001", "119002"],
    latitude: 1.2966,
    longitude: 103.8065,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8020, 1.2920], [103.8110, 1.2920], [103.8110, 1.3010], [103.8020, 1.3010], [103.8020, 1.2920]]]
    },
    mrtProximity: 0.3,
    cbdDistance: 4.2,
    amenityScore: 7.8
  },

  // District 4 - Sentosa, Harbourfront
  {
    name: "Harbourfront",
    district: "District 4",
    postalCodes: ["099001", "099002", "099003", "100001", "100002"],
    latitude: 1.2653,
    longitude: 103.8198,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8160, 1.2610], [103.8230, 1.2610], [103.8230, 1.2690], [103.8160, 1.2690], [103.8160, 1.2610]]]
    },
    mrtProximity: 0.1,
    cbdDistance: 3.5,
    amenityScore: 8.0
  },

  // District 5 - Pasir Panjang, Hong Leong Garden, Clementi New Town
  {
    name: "Clementi",
    district: "District 5",
    postalCodes: ["120001", "120002", "120003", "121001", "121002"],
    latitude: 1.3162,
    longitude: 103.7649,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.7600, 1.3120], [103.7700, 1.3120], [103.7700, 1.3200], [103.7600, 1.3200], [103.7600, 1.3120]]]
    },
    mrtProximity: 0.2,
    cbdDistance: 8.5,
    amenityScore: 7.5
  },

  // District 6 - High Street, Beach Road
  {
    name: "City Hall",
    district: "District 6",
    postalCodes: ["179001", "179002", "179003", "180001", "180002"],
    latitude: 1.2930,
    longitude: 103.8520,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8480, 1.2890], [103.8560, 1.2890], [103.8560, 1.2970], [103.8480, 1.2970], [103.8480, 1.2890]]]
    },
    mrtProximity: 0.1,
    cbdDistance: 1.0,
    amenityScore: 9.0
  },

  // District 7 - Middle Road, Golden Mile
  {
    name: "Bugis",
    district: "District 7",
    postalCodes: ["188001", "188002", "188003", "189001", "189002"],
    latitude: 1.3006,
    longitude: 103.8558,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8520, 1.2970], [103.8600, 1.2970], [103.8600, 1.3050], [103.8520, 1.3050], [103.8520, 1.2970]]]
    },
    mrtProximity: 0.1,
    cbdDistance: 1.8,
    amenityScore: 8.7
  },

  // District 8 - Little India
  {
    name: "Little India",
    district: "District 8",
    postalCodes: ["200001", "200002", "200003", "201001", "201002"],
    latitude: 1.3067,
    longitude: 103.8518,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8480, 1.3030], [103.8560, 1.3030], [103.8560, 1.3110], [103.8480, 1.3110], [103.8480, 1.3030]]]
    },
    mrtProximity: 0.1,
    cbdDistance: 2.5,
    amenityScore: 7.8
  },

  // District 9 - Orchard, Cairnhill, River Valley
  {
    name: "Orchard",
    district: "District 9",
    postalCodes: ["228001", "228002", "228003", "229001", "229002"],
    latitude: 1.3048,
    longitude: 103.8318,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8280, 1.3010], [103.8360, 1.3010], [103.8360, 1.3090], [103.8280, 1.3090], [103.8280, 1.3010]]]
    },
    mrtProximity: 0.1,
    cbdDistance: 2.2,
    amenityScore: 9.5
  },

  // District 10 - Ardmore, Bukit Timah, Holland Road, Tanglin
  {
    name: "Bukit Timah",
    district: "District 10",
    postalCodes: ["259001", "259002", "259003", "260001", "260002"],
    latitude: 1.3294,
    longitude: 103.8077,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8030, 1.3250], [103.8120, 1.3250], [103.8120, 1.3340], [103.8030, 1.3340], [103.8030, 1.3250]]]
    },
    mrtProximity: 0.5,
    cbdDistance: 5.5,
    amenityScore: 9.2
  },

  // District 11 - Watten Estate, Novena, Thomson
  {
    name: "Novena",
    district: "District 11",
    postalCodes: ["307001", "307002", "307003", "308001", "308002"],
    latitude: 1.3202,
    longitude: 103.8435,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8390, 1.3160], [103.8480, 1.3160], [103.8480, 1.3240], [103.8390, 1.3240], [103.8390, 1.3160]]]
    },
    mrtProximity: 0.1,
    cbdDistance: 4.5,
    amenityScore: 8.5
  },

  // District 12 - Balestier, Toa Payoh
  {
    name: "Toa Payoh",
    district: "District 12",
    postalCodes: ["310001", "310002", "310003", "311001", "311002"],
    latitude: 1.3343,
    longitude: 103.8474,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8430, 1.3300], [103.8520, 1.3300], [103.8520, 1.3380], [103.8430, 1.3380], [103.8430, 1.3300]]]
    },
    mrtProximity: 0.2,
    cbdDistance: 5.8,
    amenityScore: 7.5
  },

  // District 13 - Macpherson, Potong Pasir
  {
    name: "Potong Pasir",
    district: "District 13",
    postalCodes: ["350001", "350002", "350003", "351001", "351002"],
    latitude: 1.3308,
    longitude: 103.8697,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8650, 1.3270], [103.8740, 1.3270], [103.8740, 1.3350], [103.8650, 1.3350], [103.8650, 1.3270]]]
    },
    mrtProximity: 0.3,
    cbdDistance: 6.2,
    amenityScore: 6.8
  },

  // District 14 - Geylang, Eunos
  {
    name: "Geylang",
    district: "District 14",
    postalCodes: ["380001", "380002", "380003", "381001", "381002"],
    latitude: 1.3138,
    longitude: 103.8831,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8790, 1.3100], [103.8880, 1.3100], [103.8880, 1.3180], [103.8790, 1.3180], [103.8790, 1.3100]]]
    },
    mrtProximity: 0.4,
    cbdDistance: 5.5,
    amenityScore: 6.5
  },

  // District 15 - Katong, Joo Chiat, Amber Road
  {
    name: "Katong",
    district: "District 15",
    postalCodes: ["428001", "428002", "428003", "429001", "429002"],
    latitude: 1.3048,
    longitude: 103.9006,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8960, 1.3010], [103.9050, 1.3010], [103.9050, 1.3090], [103.8960, 1.3090], [103.8960, 1.3010]]]
    },
    mrtProximity: 0.6,
    cbdDistance: 7.2,
    amenityScore: 7.8
  },

  // District 16 - Bedok, Upper East Coast
  {
    name: "Bedok",
    district: "District 16",
    postalCodes: ["460001", "460002", "460003", "461001", "461002"],
    latitude: 1.3236,
    longitude: 103.9273,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.9230, 1.3200], [103.9320, 1.3200], [103.9320, 1.3280], [103.9230, 1.3280], [103.9230, 1.3200]]]
    },
    mrtProximity: 0.3,
    cbdDistance: 9.5,
    amenityScore: 7.2
  },

  // District 17 - Loyang, Changi
  {
    name: "Changi",
    district: "District 17",
    postalCodes: ["500001", "500002", "500003", "501001", "501002"],
    latitude: 1.3644,
    longitude: 103.9915,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.9870, 1.3600], [103.9960, 1.3600], [103.9960, 1.3680], [103.9870, 1.3680], [103.9870, 1.3600]]]
    },
    mrtProximity: 1.2,
    cbdDistance: 18.5,
    amenityScore: 6.0
  },

  // District 18 - Tampines, Pasir Ris
  {
    name: "Tampines",
    district: "District 18",
    postalCodes: ["520001", "520002", "520003", "521001", "521002"],
    latitude: 1.3496,
    longitude: 103.9568,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.9520, 1.3460], [103.9610, 1.3460], [103.9610, 1.3540], [103.9520, 1.3540], [103.9520, 1.3460]]]
    },
    mrtProximity: 0.2,
    cbdDistance: 15.2,
    amenityScore: 7.8
  },

  // District 19 - Serangoon Garden, Hougang, Punggol
  {
    name: "Hougang",
    district: "District 19",
    postalCodes: ["530001", "530002", "530003", "531001", "531002"],
    latitude: 1.3613,
    longitude: 103.8863,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8820, 1.3570], [103.8910, 1.3570], [103.8910, 1.3650], [103.8820, 1.3650], [103.8820, 1.3570]]]
    },
    mrtProximity: 0.3,
    cbdDistance: 12.5,
    amenityScore: 7.0
  },

  // District 20 - Bishan, Ang Mo Kio
  {
    name: "Bishan",
    district: "District 20",
    postalCodes: ["570001", "570002", "570003", "571001", "571002"],
    latitude: 1.3506,
    longitude: 103.8492,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8450, 1.3470], [103.8540, 1.3470], [103.8540, 1.3550], [103.8450, 1.3550], [103.8450, 1.3470]]]
    },
    mrtProximity: 0.2,
    cbdDistance: 8.8,
    amenityScore: 8.2
  },
  {
    name: "Ang Mo Kio",
    district: "District 20",
    postalCodes: ["560001", "560002", "560003", "561001", "561002"],
    latitude: 1.3691,
    longitude: 103.8454,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8410, 1.3650], [103.8500, 1.3650], [103.8500, 1.3730], [103.8410, 1.3730], [103.8410, 1.3650]]]
    },
    mrtProximity: 0.3,
    cbdDistance: 10.2,
    amenityScore: 7.8
  },

  // District 21 - Upper Bukit Timah, Clementi Park, Ulu Pandan
  {
    name: "Upper Bukit Timah",
    district: "District 21",
    postalCodes: ["588001", "588002", "588003", "589001", "589002"],
    latitude: 1.3438,
    longitude: 103.7764,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.7720, 1.3400], [103.7810, 1.3400], [103.7810, 1.3480], [103.7720, 1.3480], [103.7720, 1.3400]]]
    },
    mrtProximity: 0.8,
    cbdDistance: 12.5,
    amenityScore: 8.5
  },

  // District 22 - Jurong
  {
    name: "Jurong East",
    district: "District 22",
    postalCodes: ["600001", "600002", "600003", "601001", "601002"],
    latitude: 1.3329,
    longitude: 103.7436,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.7390, 1.3290], [103.7480, 1.3290], [103.7480, 1.3370], [103.7390, 1.3370], [103.7390, 1.3290]]]
    },
    mrtProximity: 0.2,
    cbdDistance: 15.8,
    amenityScore: 7.5
  },

  // District 23 - Hillview, Dairy Farm, Bukit Panjang, Choa Chu Kang
  {
    name: "Bukit Panjang",
    district: "District 23",
    postalCodes: ["670001", "670002", "670003", "671001", "671002"],
    latitude: 1.3774,
    longitude: 103.7723,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.7680, 1.3730], [103.7770, 1.3730], [103.7770, 1.3810], [103.7680, 1.3810], [103.7680, 1.3730]]]
    },
    mrtProximity: 0.3,
    cbdDistance: 18.2,
    amenityScore: 6.8
  },

  // District 25 - Kranji, Woodgrove
  {
    name: "Woodlands",
    district: "District 25",
    postalCodes: ["730001", "730002", "730003", "731001", "731002"],
    latitude: 1.4382,
    longitude: 103.7890,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.7850, 1.4340], [103.7940, 1.4340], [103.7940, 1.4420], [103.7850, 1.4420], [103.7850, 1.4340]]]
    },
    mrtProximity: 0.4,
    cbdDistance: 25.5,
    amenityScore: 6.5
  },

  // District 26 - Upper Thomson, Springleaf
  {
    name: "Thomson",
    district: "District 26",
    postalCodes: ["574001", "574002", "574003", "575001", "575002"],
    latitude: 1.3547,
    longitude: 103.8317,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8270, 1.3510], [103.8360, 1.3510], [103.8360, 1.3590], [103.8270, 1.3590], [103.8270, 1.3510]]]
    },
    mrtProximity: 0.5,
    cbdDistance: 9.5,
    amenityScore: 8.0
  },

  // District 27 - Yishun, Sembawang
  {
    name: "Yishun",
    district: "District 27",
    postalCodes: ["760001", "760002", "760003", "761001", "761002"],
    latitude: 1.4304,
    longitude: 103.8354,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8310, 1.4260], [103.8400, 1.4260], [103.8400, 1.4340], [103.8310, 1.4340], [103.8310, 1.4260]]]
    },
    mrtProximity: 0.3,
    cbdDistance: 22.8,
    amenityScore: 6.8
  },

  // District 28 - Seletar
  {
    name: "Seletar",
    district: "District 28",
    postalCodes: ["797001", "797002", "797003", "798001", "798002"],
    latitude: 1.4048,
    longitude: 103.8692,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.8650, 1.4010], [103.8740, 1.4010], [103.8740, 1.4090], [103.8650, 1.4090], [103.8650, 1.4010]]]
    },
    mrtProximity: 1.5,
    cbdDistance: 20.5,
    amenityScore: 6.2
  }
];
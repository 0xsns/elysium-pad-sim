// Elysium launchpad universe - read from live sources on 2026-11-09.
// Source A: elyscreener.com/coin/<addr> -> which pad launched the token, risk + bot-bundle flags
// Source B: api.geckoterminal.com /networks/elysium -> pool id, 24h volume, liquidity, price change
// `pool` values are real Uniswap v4 pool ids on chain 99901 (Elysium). No placeholders.

export const CHAIN = {
  id: 99901,
  name: "Elysium",
  rpc: "https://rpc-elysium.perpme.fun",
  gas: "HYPE",
  explorer: "https://elysium.kinetiq.xyz",
};

export const PADS = [
  {
    "id": "montra",
    "name": "Montra",
    "blurb": "Bonding-curve pad \u00b7 highest coin count on the chain",
    "color": "#40ffd0",
    "stats": {
      "vol24": 5940000,
      "trades24": 48300,
      "holders": 9163,
      "newToday": 3084,
      "alive24h": 3,
      "creatorSold": 3,
      "coins": 30300
    }
  },
  {
    "id": "ascend",
    "name": "Ascend",
    "blurb": "Kinetiq partner pad \u00b7 best graduation rate on chain",
    "color": "#7dffb2",
    "stats": {
      "vol24": 5350000,
      "trades24": 32200,
      "holders": 7436,
      "newToday": 402,
      "alive24h": 12,
      "creatorSold": 16,
      "coins": 1327
    }
  },
  {
    "id": "volta",
    "name": "Volta",
    "blurb": "Uniswap v4 launches \u00b7 no bonding curve",
    "color": "#ffb020",
    "stats": {
      "vol24": 2960000,
      "trades24": 3200,
      "holders": 3101,
      "newToday": 60,
      "alive24h": 5,
      "creatorSold": 22,
      "coins": 60
    }
  },
  {
    "id": "other",
    "name": "Other pads",
    "blurb": "Kleos / BOXA / ElysPump / Obol \u2014 not tracked in this sim",
    "color": "#6b8296",
    "stats": {
      "vol24": 0,
      "trades24": 0,
      "holders": 0,
      "newToday": 0,
      "alive24h": 0,
      "creatorSold": 0,
      "coins": 0
    }
  }
];

export const TOKENS = [
  {
    "sym": "e",
    "addr": "0x8df4f39d592de2aaee15838b265c2392d19a4128",
    "pool": "0xc0be17156606216257c638d839c1dd6d43955a565e0b3d6c568d79ebe82cf84c",
    "pad": "ascend",
    "vol24": 1903229,
    "liq": 0,
    "chg24": "179.751",
    "risk": "safe",
    "bots": null,
    "devSold": false
  },
  {
    "sym": "VOLTA",
    "addr": "0x0f79931689af199e7cf868ed1107bba2c83c68f7",
    "pool": "0x7b182abb748bae25e2c73abd8b4cf3157d8d35a47e4b36d1ee5565ade94c3c27",
    "pad": "volta",
    "vol24": 1055597,
    "liq": 124864,
    "chg24": "418.723",
    "risk": "risky",
    "bots": 17,
    "devSold": true
  },
  {
    "sym": "EACCAT",
    "addr": "0x32193afd14c53f12c45a4c04eca9f7ba98e3ec71",
    "pool": "0x35bd0e6a8b82e0e18b0381757d97ba01cde11a02740f006132dd40395ffc8ce2",
    "pad": "montra",
    "vol24": 727573,
    "liq": 0,
    "chg24": "-9.097",
    "risk": "safe",
    "bots": null,
    "devSold": false
  },
  {
    "sym": "CHAMELEON",
    "addr": "0xd662d66ec991a3eae4ecbda34327264c53d4cf38",
    "pool": "0x61a799e016a5433af3e67cee4ca32dae81338c1ae7287192dc9d69b83b282aac",
    "pad": "montra",
    "vol24": 608792,
    "liq": 0,
    "chg24": "-36.853",
    "risk": "safe",
    "bots": null,
    "devSold": false
  },
  {
    "sym": "A",
    "addr": "0xaacc5bc6ea24cb753e5c2d48c88f7e361a50aacc",
    "pool": "0x28a9cbb68fd01d2e83660543d08f0485a016d4ac92b277743c481983a0a4a9ed",
    "pad": "other",
    "vol24": 569982,
    "liq": 0,
    "chg24": "52521.927",
    "risk": "safe",
    "bots": null,
    "devSold": false
  },
  {
    "sym": "WORTH",
    "addr": "0x87b376b1aa443200a81f641dad99b9532d7d969d",
    "pool": "0xe6d05a108b50e4282fa68f019233a6b289061ddecda413c111c528213062a111",
    "pad": "montra",
    "vol24": 434797,
    "liq": 30053,
    "chg24": "-98.441",
    "risk": "safe",
    "bots": null,
    "devSold": false
  },
  {
    "sym": "NMEOWS",
    "addr": "0xc6088be9c99787463a5fc655091e589cb0da0c3a",
    "pool": "0x87f850fb011fba4db401b65fde449dea2224416f8c503e3f11f95574267eaa67",
    "pad": "other",
    "vol24": 429627,
    "liq": 72463,
    "chg24": "44.146",
    "risk": "safe",
    "bots": null,
    "devSold": false
  },
  {
    "sym": "YIELDEX",
    "addr": "0x301eb259de132d592966fe0712db75b27792a68a",
    "pool": "0xdfd40b01deffb01d04c995998ecc89ff4df3dbc6b4b16301026156d2a5304d45",
    "pad": "volta",
    "vol24": 355459,
    "liq": 8545,
    "chg24": "6396.216",
    "risk": "safe",
    "bots": null,
    "devSold": false
  },
  {
    "sym": "BOZO",
    "addr": "0x61e6c090fb341b5cd41a17bb0f895f0f9e3a756b",
    "pool": "0x321369eeddc0e49cc39ab817eb9f91822a57f7a80f11db18bcd0ff20f73ccbee",
    "pad": "ascend",
    "vol24": 352165,
    "liq": 37609,
    "chg24": "3039.789",
    "risk": "safe",
    "bots": null,
    "devSold": false
  },
  {
    "sym": "SENDU",
    "addr": "0x02f4989b71e70e126e3449f883f8dc9dc0154c5b",
    "pool": "0x3340e74b13f37081eb240b54ce0a98023a5e26099e50c76ee3ebda5244b67563",
    "pad": "ascend",
    "vol24": 337047,
    "liq": 41894,
    "chg24": "3564.261",
    "risk": "safe",
    "bots": null,
    "devSold": false
  },
  {
    "sym": "LIQUITTY",
    "addr": "0x52d3473135334ecaab569de7cd50580ff9ea3c3f",
    "pool": "0x42bb8820c745139b4809da13f18f9d54edc664430181a7bf32eb04e7eeb86085",
    "pad": "montra",
    "vol24": 244578,
    "liq": 12276,
    "chg24": "546.995",
    "risk": "safe",
    "bots": null,
    "devSold": false
  },
  {
    "sym": "VOID",
    "addr": "0xd31b21cb80e431ac996269dec31a40fcf048b77f",
    "pool": "0xe488e93cba1cbbb1493d898a4f352571d0d96ddc4902f5449d07ad33ee34ee08",
    "pad": "volta",
    "vol24": 206536,
    "liq": 94415,
    "chg24": "80.442",
    "risk": "safe",
    "bots": null,
    "devSold": false
  },
  {
    "sym": "EGG",
    "addr": "0x88e49f7e08c503e1d89ebc56ebc1119cd594dfb1",
    "pool": "0xdc90006e28a3e422deef64e021a5893058e491c7e55e1f32b3e826193828b855",
    "pad": "other",
    "vol24": 193629,
    "liq": 21535,
    "chg24": "-61.197",
    "risk": "unknown",
    "bots": null,
    "devSold": false
  },
  {
    "sym": "ELYSA",
    "addr": "0xcac5b6e74eb7383af0a6dc344d996e225bbf9a17",
    "pool": "0xb54cc33ede14dd38657e7104396e3a7241634648dbaa40c3952bc907c1a275b3",
    "pad": "other",
    "vol24": 162909,
    "liq": 0,
    "chg24": "-16.244",
    "risk": "unknown",
    "bots": null,
    "devSold": false
  }
];

export const PAD_BY_ID = Object.fromEntries(PADS.map((p) => [p.id, p]));

export function tokensOfPad(padId) {
  return TOKENS.filter((t) => t.pad === padId);
}

export function tokenById(id) {
  const k = String(id || "").toLowerCase();
  return TOKENS.find((t) => t.addr.toLowerCase() === k || t.sym.toLowerCase() === k) || null;
}

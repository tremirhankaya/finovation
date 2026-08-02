package com.infina.portfoliomanagement.marketdata.client;

import java.util.Set;

public final class InfinaEndpoints {

    public static final String STOCK_PRICE = "/HisseFiyat";
    public static final String STOCK_DEFINITION = "/HisseTanim";
    public static final String TPP_RATE = "/TppOran";
    public static final String HOLIDAYS = "/TatilGunleri";
    public static final String INDEX_PRICE = "/EndeksFiyat";
    public static final String FOREX_RATE = "/DovizFiyat";
    public static final String CAPITAL_INCREASE = "/SermayeArtirim";
    public static final String MARKET_PRICE = "/MarketPrice";

    public static final Set<String> ALLOWED = Set.of(
            STOCK_PRICE, STOCK_DEFINITION, TPP_RATE, HOLIDAYS,
            INDEX_PRICE, FOREX_RATE, CAPITAL_INCREASE, MARKET_PRICE
    );

    private InfinaEndpoints() {
    }
}

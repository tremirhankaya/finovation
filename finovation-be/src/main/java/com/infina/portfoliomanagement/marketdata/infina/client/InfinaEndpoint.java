package com.infina.portfoliomanagement.marketdata.infina.client;

public enum InfinaEndpoint {

    STOCK_PRICE("/HisseFiyat"),
    STOCK_DEFINITION("/HisseTanim"),
    CODE_DEFINITION("/KodTanim"),
    SECTOR_DEFINITION("/SektorTanim"),
    INDEX_PRICE("/EndeksFiyat"),
    CAPITAL_INCREASE("/SermayeArtirim"),
    TPP_RATE("/TppOran"),
    HOLIDAYS("/TatilGunleri");

    private final String path;

    InfinaEndpoint(String path) {
        this.path = path;
    }

    public String path() {
        return path;
    }

    public String dataKey() {
        return path.substring(1);
    }
}

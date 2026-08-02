package com.infina.portfoliomanagement.marketdata.runner;

import java.io.IOException;

public interface MarketDataIngestJob {

    String key();

    void run() throws IOException;
}

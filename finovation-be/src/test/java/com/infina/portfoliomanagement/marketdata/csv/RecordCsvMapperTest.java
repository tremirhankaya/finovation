package com.infina.portfoliomanagement.marketdata.csv;

import com.infina.portfoliomanagement.marketdata.ingest.dovizfiyat.dto.ForexRateRecord;
import com.infina.portfoliomanagement.marketdata.ingest.endeksfiyat.dto.IndexPriceRecord;
import com.infina.portfoliomanagement.marketdata.ingest.hissefiyat.dto.StockPriceRecord;
import com.infina.portfoliomanagement.marketdata.ingest.marketprice.dto.MarketPriceRecord;
import com.infina.portfoliomanagement.marketdata.ingest.sermayeartirim.dto.CapitalIncreaseRecord;
import com.infina.portfoliomanagement.marketdata.ingest.tatilgunleri.dto.HolidayRecord;
import com.infina.portfoliomanagement.marketdata.ingest.tpporan.dto.TppOranRecord;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;


class RecordCsvMapperTest {

    @Test
    void stockPriceRecordHeaderMatchesDeliveredCsvColumnOrder() {
        RecordCsvMapper<StockPriceRecord> mapper = RecordCsvMapper.of(StockPriceRecord.class);

        assertThat(mapper.header()).containsExactly(
                "asset_code", "data_date", "open_price", "high_price", "low_price", "close_price");
    }

    @Test
    void stockPriceRecordRowMatchesHeaderOrder() {
        RecordCsvMapper<StockPriceRecord> mapper = RecordCsvMapper.of(StockPriceRecord.class);
        StockPriceRecord record = new StockPriceRecord(
                "AKBNK.E", LocalDate.of(2026, 1, 2),
                BigDecimal.valueOf(50), BigDecimal.valueOf(51), BigDecimal.valueOf(49), BigDecimal.valueOf(50.5));

        assertThat(mapper.toRow(record)).containsExactly(
                "AKBNK.E", "2026-01-02", "50", "51", "49", "50.5");
    }

    @Test
    void tppOranRecordHeaderMatchesDeliveredCsvColumnOrder() {
        RecordCsvMapper<TppOranRecord> mapper = RecordCsvMapper.of(TppOranRecord.class);

        assertThat(mapper.header()).containsExactly(
                "data_date", "issue_date", "trading_volume_TR", "transaction_count", "low_rate", "weighted_average",
                "close_rate", "maturity_date", "day", "open_rate", "high_rate");
    }

    @Test
    void tppOranFilledRateRowOnlyPopulatesDateAndRate() {
        RecordCsvMapper<TppOranRecord> mapper = RecordCsvMapper.of(TppOranRecord.class);
        TppOranRecord filled = TppOranRecord.filledRate(LocalDate.of(2026, 1, 3), BigDecimal.valueOf(45.5));

        List<String> row = mapper.toRow(filled);

        assertThat(row).containsExactly("2026-01-03", "", "", "", "", "45.5", "", "", "", "", "");
    }

    @Test
    void holidayRecordHeaderMatchesDeliveredCsvColumnOrder() {
        RecordCsvMapper<HolidayRecord> mapper = RecordCsvMapper.of(HolidayRecord.class);

        assertThat(mapper.header()).containsExactly("data_date", "tarih", "aciklama", "yarim_gun", "yil");
    }

    @Test
    void holidayRecordRowMatchesHeaderOrder() {
        RecordCsvMapper<HolidayRecord> mapper = RecordCsvMapper.of(HolidayRecord.class);
        HolidayRecord record = new HolidayRecord(
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 1), "Yeni Yıl Tatili", Boolean.FALSE, 2026);

        assertThat(mapper.toRow(record)).containsExactly(
                "2026-01-01", "2026-01-01", "Yeni Yıl Tatili", "false", "2026");
    }

    @Test
    void indexPriceRecordHeaderMatchesDeliveredCsvColumnOrder() {
        RecordCsvMapper<IndexPriceRecord> mapper = RecordCsvMapper.of(IndexPriceRecord.class);

        assertThat(mapper.header()).containsExactly(
                "data_date", "asset_code", "asset_name", "open_price", "high_price", "low_price", "close_price",
                "close_price_TRY_BID", "close_price_TRY_ASK", "currency", "security_type", "record_id",
                "record_date");
    }

    @Test
    void indexPriceRecordRowMatchesHeaderOrder() {
        RecordCsvMapper<IndexPriceRecord> mapper = RecordCsvMapper.of(IndexPriceRecord.class);
        IndexPriceRecord record = new IndexPriceRecord(
                LocalDate.of(2026, 1, 2), "XU100", "BIST 100",
                BigDecimal.valueOf(9500), BigDecimal.valueOf(9600), BigDecimal.valueOf(9400), BigDecimal.valueOf(9550),
                BigDecimal.valueOf(280.5), BigDecimal.valueOf(281.0),
                "TRY", "INDEX", "REC123", LocalDateTime.of(2026, 1, 2, 18, 30));

        assertThat(mapper.toRow(record)).containsExactly(
                "2026-01-02", "XU100", "BIST 100", "9500", "9600", "9400", "9550",
                "280.5", "281.0", "TRY", "INDEX", "REC123", "2026-01-02T18:30");
    }

    @Test
    void forexRateRecordHeaderMatchesDeliveredCsvColumnOrder() {
        RecordCsvMapper<ForexRateRecord> mapper = RecordCsvMapper.of(ForexRateRecord.class);

        assertThat(mapper.header()).containsExactly(
                "data_date", "asset_code", "asset_name", "bid", "ask", "market_code", "record_id", "record_date");
    }

    @Test
    void forexRateRecordRowMatchesHeaderOrder() {
        RecordCsvMapper<ForexRateRecord> mapper = RecordCsvMapper.of(ForexRateRecord.class);
        ForexRateRecord record = new ForexRateRecord(
                LocalDate.of(2026, 1, 2), "USD/TRY", "USD/TRY",
                BigDecimal.valueOf(34.5), BigDecimal.valueOf(34.55), "TCMB", "REC456",
                LocalDateTime.of(2026, 1, 2, 15, 0));

        assertThat(mapper.toRow(record)).containsExactly(
                "2026-01-02", "USD/TRY", "USD/TRY", "34.5", "34.55", "TCMB", "REC456", "2026-01-02T15:00");
    }

    @Test
    void capitalIncreaseRecordHeaderMatchesDeliveredCsvColumnOrder() {
        RecordCsvMapper<CapitalIncreaseRecord> mapper = RecordCsvMapper.of(CapitalIncreaseRecord.class);

        assertThat(mapper.header()).containsExactly(
                "data_date", "code", "bonus", "dividend", "right", "ratio", "status");
    }

    @Test
    void capitalIncreaseRecordRowMatchesHeaderOrder() {
        RecordCsvMapper<CapitalIncreaseRecord> mapper = RecordCsvMapper.of(CapitalIncreaseRecord.class);
        CapitalIncreaseRecord record = new CapitalIncreaseRecord(
                LocalDate.of(2026, 3, 15), "AKBNK", BigDecimal.valueOf(25), BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.valueOf(1.25), 1);

        assertThat(mapper.toRow(record)).containsExactly(
                "2026-03-15", "AKBNK", "25", "0", "0", "1.25", "1");
    }

    @Test
    void marketPriceRecordHeaderMatchesDeliveredCsvColumnOrder() {
        RecordCsvMapper<MarketPriceRecord> mapper = RecordCsvMapper.of(MarketPriceRecord.class);

        assertThat(mapper.header()).containsExactly(
                "data_date", "asset_code", "vendor", "vendor_code", "currency",
                "open_price", "high_price", "low_price", "close_price", "record_date");
    }

    @Test
    void marketPriceRecordRowMatchesHeaderOrder() {
        RecordCsvMapper<MarketPriceRecord> mapper = RecordCsvMapper.of(MarketPriceRecord.class);
        MarketPriceRecord record = new MarketPriceRecord(
                LocalDate.of(2026, 1, 2), "XAUUSD", "YH", "GC=F", "USD",
                BigDecimal.valueOf(2650.5), BigDecimal.valueOf(2660.0), BigDecimal.valueOf(2645.0),
                BigDecimal.valueOf(2655.25), LocalDateTime.of(2026, 1, 2, 9, 15));

        assertThat(mapper.toRow(record)).containsExactly(
                "2026-01-02", "XAUUSD", "YH", "GC=F", "USD", "2650.5", "2660.0", "2645.0", "2655.25",
                "2026-01-02T09:15");
    }

    @Test
    void marketPriceRecordRowRendersMissingOptionalFieldsAsEmpty() {
        RecordCsvMapper<MarketPriceRecord> mapper = RecordCsvMapper.of(MarketPriceRecord.class);
        MarketPriceRecord record = new MarketPriceRecord(
                LocalDate.of(2026, 1, 2), "BRNT.L", null, "BRNT.L", "USD",
                null, null, null, BigDecimal.valueOf(30.88), null);

        assertThat(mapper.toRow(record)).containsExactly(
                "2026-01-02", "BRNT.L", "", "BRNT.L", "USD", "", "", "", "30.88", "");
    }

    private record NoAnnotations(String assetCode, Integer retryCount) {
    }

    @Test
    void fallsBackToSnakeCaseWhenJsonPropertyIsAbsent() {
        RecordCsvMapper<NoAnnotations> mapper = RecordCsvMapper.of(NoAnnotations.class);

        assertThat(mapper.header()).containsExactly("asset_code", "retry_count");
        assertThat(mapper.toRow(new NoAnnotations("AKBNK.E", 3))).containsExactly("AKBNK.E", "3");
    }
}

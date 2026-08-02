package com.infina.portfoliomanagement.marketdata.ingest.tpporan.service;

import com.infina.portfoliomanagement.marketdata.ingest.tpporan.dto.TppOranRecord;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeMap;

@Component
public class TppOranForwardFiller {

    public List<TppOranRecord> fill(List<TppOranRecord> records) {
        if (records.isEmpty()) {
            return List.of();
        }

        TreeMap<LocalDate, TppOranRecord> recordsByDate = new TreeMap<>();
        for (TppOranRecord record : records) {
            recordsByDate.put(record.dataDate(), record);
        }

        LocalDate firstDate = recordsByDate.firstKey();
        LocalDate lastDate = recordsByDate.lastKey();

        List<TppOranRecord> filled = new ArrayList<>();
        BigDecimal lastKnownRate = null;

        for (LocalDate date = firstDate; !date.isAfter(lastDate); date = date.plusDays(1)) {
            TppOranRecord recordForDate = recordsByDate.get(date);
            if (recordForDate != null) {
                lastKnownRate = recordForDate.weightedAverage();
                filled.add(recordForDate);
            } else {
                filled.add(TppOranRecord.filledRate(date, lastKnownRate));
            }
        }

        return filled;
    }
}

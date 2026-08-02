package com.infina.portfoliomanagement.marketdata.csv;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.function.Function;


@Component
public class CsvFileWriter {

    public <T> void write(Path outputFile, List<String> header, List<T> records, Function<T, List<String>> rowMapper) {
        try (Writer writer = Files.newBufferedWriter(outputFile, StandardCharsets.UTF_8);
             CSVPrinter printer = new CSVPrinter(writer, CSVFormat.DEFAULT.builder()
                     .setHeader(header.toArray(new String[0]))
                     .build())) {

            for (T record : records) {
                printer.printRecord(rowMapper.apply(record));
            }

        } catch (IOException e) {
            throw new UncheckedIOException("Failed to write CSV file: " + outputFile, e);
        }
    }
}

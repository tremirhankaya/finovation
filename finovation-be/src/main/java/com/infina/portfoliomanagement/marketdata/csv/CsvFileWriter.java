package com.infina.portfoliomanagement.marketdata.csv;

import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFileAttributeView;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.List;
import java.util.function.Function;


@Slf4j
@Component
public class CsvFileWriter {

    private static final Path ALLOWED_ROOT = Path.of("data-export").toAbsolutePath().normalize();

    public <T> void write(Path outputFile, List<String> header, List<T> records, Function<T, List<String>> rowMapper) {
        Path resolved = outputFile.toAbsolutePath().normalize();
        if (!resolved.startsWith(ALLOWED_ROOT)) {
            throw new IllegalArgumentException("Output file escapes the data-export directory: " + outputFile);
        }

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

        restrictPermissions(outputFile);
    }

    private void restrictPermissions(Path outputFile) {
        try {
            if (Files.getFileStore(outputFile).supportsFileAttributeView(PosixFileAttributeView.class)) {
                Files.setPosixFilePermissions(outputFile, PosixFilePermissions.fromString("rw-r-----"));
            }
        } catch (IOException e) {
            log.warn("Could not restrict permissions on {}", outputFile, e);
        }
    }
}

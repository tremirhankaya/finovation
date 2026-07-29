package com.infina.portfoliomanagement;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan

public class PortfoliomanagementApplication {

	public static void main(String[] args) {
		SpringApplication.run(PortfoliomanagementApplication.class, args);
	}

}

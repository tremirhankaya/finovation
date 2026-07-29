package com.infina.portfoliomanagement.company.repository;

import com.infina.portfoliomanagement.company.entity.Company;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompanyRepository extends JpaRepository<Company, Long> {
}
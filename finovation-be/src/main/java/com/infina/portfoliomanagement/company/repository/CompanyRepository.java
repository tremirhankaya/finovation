package com.infina.portfoliomanagement.company.repository;

import com.infina.portfoliomanagement.company.entity.Company;
import com.infina.portfoliomanagement.company.enums.CompanyStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CompanyRepository extends JpaRepository<Company, Long> {

    List<Company> findAllByStatusOrderByNameAsc(CompanyStatus status);
}
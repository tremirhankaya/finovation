package com.infina.portfoliomanagement.fund.repository;

import com.infina.portfoliomanagement.fund.entity.FundDesignProfile;
import com.infina.portfoliomanagement.fund.enums.FundType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FundDesignProfileRepository extends JpaRepository<FundDesignProfile, Long> {

    Optional<FundDesignProfile> findByFundType(FundType fundType);
}

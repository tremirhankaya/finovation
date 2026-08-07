package com.infina.portfoliomanagement.fund.repository;

import com.infina.portfoliomanagement.fund.entity.FundConstraint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FundConstraintRepository extends JpaRepository<FundConstraint, Long> {

    List<FundConstraint> findAllByFundDraft_Id(Long fundDraftId);

    void deleteAllByFundDraft_Id(Long fundDraftId);
}

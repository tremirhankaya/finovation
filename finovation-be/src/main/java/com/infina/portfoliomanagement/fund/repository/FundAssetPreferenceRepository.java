package com.infina.portfoliomanagement.fund.repository;

import com.infina.portfoliomanagement.fund.entity.FundAssetPreference;
import com.infina.portfoliomanagement.fund.enums.FundAssetPreferenceType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FundAssetPreferenceRepository
        extends JpaRepository<FundAssetPreference, Long> {

    List<FundAssetPreference> findAllByFundDraftId(Long fundDraftId);

    List<FundAssetPreference> findAllByFundDraftIdAndPreferenceType(
            Long fundDraftId,
            FundAssetPreferenceType preferenceType
    );

    void deleteAllByFundDraftId(Long fundDraftId);
}

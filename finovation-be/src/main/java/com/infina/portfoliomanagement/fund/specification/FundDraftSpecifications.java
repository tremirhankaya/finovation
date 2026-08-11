package com.infina.portfoliomanagement.fund.specification;

import com.infina.portfoliomanagement.fund.dto.FundDraftSearchCriteria;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

public final class FundDraftSpecifications {

    private FundDraftSpecifications() {
    }

    public static Specification<FundDraft> from(Long ownerId, FundDraftSearchCriteria criteria) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            predicates.add(criteriaBuilder.equal(root.get("createdByUserId"), ownerId));

            if (criteria.status() != null) {
                predicates.add(criteriaBuilder.equal(root.get("status"), criteria.status()));
            }

            if (criteria.managementApproach() != null) {
                predicates.add(criteriaBuilder.equal(
                        root.get("managementApproach"),
                        criteria.managementApproach()
                ));
            }

            if (criteria.designMode() != null) {
                predicates.add(criteriaBuilder.equal(
                        root.get("designMode"),
                        criteria.designMode()
                ));
            }

            if (criteria.hasQuery()) {
                predicates.add(criteriaBuilder.like(
                        criteriaBuilder.lower(root.get("name")),
                        "%" + criteria.query().toLowerCase() + "%"
                ));
            }

            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
    }
}

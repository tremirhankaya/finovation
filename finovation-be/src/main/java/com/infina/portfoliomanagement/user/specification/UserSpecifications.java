package com.infina.portfoliomanagement.user.specification;

import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.enums.Role;
import com.infina.portfoliomanagement.user.enums.UserStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public final class UserSpecifications {

    private UserSpecifications() {
    }

    public static Specification<User> from(
            Long companyId,
            Role role,
            UserStatus status,
            String query,
            LocalDate createdFrom,
            LocalDate createdTo
    ) {
        return (root, criteriaQuery, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (companyId != null) {
                predicates.add(criteriaBuilder.equal(root.get("company").get("id"), companyId));
            }

            if (role != null) {
                predicates.add(criteriaBuilder.equal(root.get("role"), role));
            }

            if (status != null) {
                predicates.add(criteriaBuilder.equal(root.get("status"), status));
            }

            if (query != null && !query.isBlank()) {
                String pattern = "%" + query.toLowerCase() + "%";
                Predicate usernameMatch = criteriaBuilder.like(
                        criteriaBuilder.lower(root.get("username")),
                        pattern
                );
                Predicate fullNameMatch = criteriaBuilder.like(
                        criteriaBuilder.lower(
                                criteriaBuilder.concat(
                                        criteriaBuilder.concat(root.get("firstName"), " "),
                                        root.get("lastName")
                                )
                        ),
                        pattern
                );
                predicates.add(criteriaBuilder.or(usernameMatch, fullNameMatch));
            }

            if (createdFrom != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(
                        root.get("createdAt"),
                        createdFrom.atStartOfDay()
                ));
            }

            if (createdTo != null) {
                predicates.add(criteriaBuilder.lessThan(
                        root.get("createdAt"),
                        createdTo.plusDays(1).atStartOfDay()
                ));
            }

            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
    }
}

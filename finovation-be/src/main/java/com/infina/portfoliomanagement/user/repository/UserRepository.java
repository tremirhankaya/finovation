package com.infina.portfoliomanagement.user.repository;

import com.infina.portfoliomanagement.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    boolean existsByUsername(String username);

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    @Query("""
            SELECT user
            FROM User user
            WHERE (:companyId IS NULL OR user.company.id = :companyId)
              AND (
                    :query = ''
                    OR LOWER(user.username) LIKE LOWER(CONCAT('%', :query, '%'))
                    OR LOWER(CONCAT(CONCAT(user.firstName, ' '), user.lastName))
                       LIKE LOWER(CONCAT('%', :query, '%'))
                  )
            """)
    Page<User> searchUsers(
            @Param("companyId") Long companyId,
            @Param("query") String query,
            Pageable pageable
    );
}

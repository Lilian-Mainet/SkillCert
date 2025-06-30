;; SkillCert - Professional Certification Platform

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-authorized (err u101))
(define-constant err-credential-not-found (err u102))
(define-constant err-invalid-parameter (err u103))
(define-constant err-already-verified (err u104))
(define-constant err-not-verified (err u105))
(define-constant err-expired-credential (err u106))
(define-constant err-insufficient-funds (err u107))

;; Data variables
(define-data-var total-credentials uint u0)
(define-data-var platform-fee uint u500000) ;; 0.5 STX in microSTX
(define-data-var total-platform-fees uint u0)
(define-data-var contract-paused bool false)

;; Credential NFT data structure
(define-map credentials
    uint
    {
        holder: principal,
        issuer: principal,
        skill-name: (string-utf8 64),
        skill-category: (string-utf8 32),
        certification-level: uint, ;; 1=Basic, 2=Intermediate, 3=Advanced, 4=Expert
        issue-date: uint,
        expiry-date: uint,
        verified: bool,
        metadata-uri: (string-utf8 256),
        revoked: bool,
    }
)

;; Issuer authorization and reputation
(define-map authorized-issuers
    principal
    {
        name: (string-utf8 128),
        issuer-type: uint, ;; 1=Educational, 2=Corporate, 3=Professional Body
        verified: bool,
        credentials-issued: uint,
        reputation-score: uint,
    }
)

;; Skill category definitions
(define-map skill-categories
    (string-utf8 32)
    {
        active: bool,
        total-credentials: uint,
        category-description: (string-utf8 128),
    }
)

;; Holder profiles
(define-map holder-profiles
    principal
    {
        total-credentials: uint,
        verified-credentials: uint,
        skill-points: uint,
        profile-active: bool,
    }
)

;; Read-only functions
(define-read-only (get-credential-details (credential-id uint))
    (map-get? credentials credential-id)
)

(define-read-only (get-issuer-info (issuer principal))
    (map-get? authorized-issuers issuer)
)

(define-read-only (get-holder-profile (holder principal))
    (map-get? holder-profiles holder)
)

(define-read-only (get-skill-category (category (string-utf8 32)))
    (map-get? skill-categories category)
)

(define-read-only (get-total-credentials)
    (var-get total-credentials)
)

(define-read-only (is-credential-valid (credential-id uint))
    (let ((credential (unwrap! (map-get? credentials credential-id) (err u0))))
        (ok (and
            (get verified credential)
            (not (get revoked credential))
            (> (get expiry-date credential) stacks-block-height)
        ))
    )
)

;; Private functions
(define-private (calculate-skill-points (level uint))
    (if (is-eq level u1)
        u10 ;; Basic: 10 points
        (if (is-eq level u2)
            u25 ;; Intermediate: 25 points
            (if (is-eq level u3)
                u50 ;; Advanced: 50 points
                (if (is-eq level u4)
                    u100 ;; Expert: 100 points
                    u0
                )
            )
        )
    )
)

;; Issuer management
(define-public (register-issuer
        (name (string-utf8 128))
        (issuer-type uint)
    )
    (begin
        (asserts! (not (var-get contract-paused)) err-invalid-parameter)
        (asserts! (and (>= issuer-type u1) (<= issuer-type u3))
            err-invalid-parameter
        )
        (asserts! (is-none (map-get? authorized-issuers tx-sender))
            err-invalid-parameter
        )
        (map-set authorized-issuers tx-sender {
            name: name,
            issuer-type: issuer-type,
            verified: false,
            credentials-issued: u0,
            reputation-score: u0,
        })
        (ok true)
    )
)

(define-public (verify-issuer (issuer principal))
    (let ((issuer-info (unwrap! (map-get? authorized-issuers issuer) err-not-authorized)))
        (begin
            (asserts! (is-eq tx-sender contract-owner) err-owner-only)
            (asserts! (not (get verified issuer-info)) err-already-verified)
            (map-set authorized-issuers issuer
                (merge issuer-info { verified: true })
            )
            (ok true)
        )
    )
)

(define-public (add-skill-category
        (category (string-utf8 32))
        (description (string-utf8 128))
    )
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (asserts! (is-none (map-get? skill-categories category))
            err-invalid-parameter
        )
        (map-set skill-categories category {
            active: true,
            total-credentials: u0,
            category-description: description,
        })
        (ok true)
    )
)

;; Administrative functions
(define-public (set-platform-fee (new-fee uint))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (asserts! (<= new-fee u5000000) err-invalid-parameter) ;; Max 5 STX
        (var-set platform-fee new-fee)
        (ok true)
    )
)

(define-public (toggle-contract-pause)
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (var-set contract-paused (not (var-get contract-paused)))
        (ok true)
    )
)

(define-public (withdraw-platform-fees)
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (let ((fees (var-get total-platform-fees)))
            (var-set total-platform-fees u0)
            (stx-transfer? fees tx-sender contract-owner)
        )
    )
)

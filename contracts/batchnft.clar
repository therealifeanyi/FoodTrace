 
;; FoodTrace BatchNFT Contract
;; Clarity v2 (assuming latest syntax as of 2025, using define-trait, etc.)
;; Implements SIP-009 compliant NFTs for food batches, with metadata, transfer, burn, flagging for recalls, admin controls, and more.

;; Constants for errors
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-NOT-OWNER u101)
(define-constant ERR-NFT-NOT-EXISTS u102)
(define-constant ERR-ALREADY-FLAGGED u103)
(define-constant ERR-PAUSED u104)
(define-constant ERR-ZERO-ADDRESS u105)
(define-constant ERR-INVALID-METADATA u106)
(define-constant ERR-MAX-MINT-LIMIT u107)
(define-constant ERR-FLAG-NOT-ALLOWED u108)
(define-constant ERR-TRANSFER-FROZEN u109)

;; NFT metadata constants
(define-constant CONTRACT-NAME "FoodTrace BatchNFT")
(define-constant NFT-SYMBOL "FTBNFT")
(define-constant MAX-MINT-PER-BATCH u1000) ;; Arbitrary limit per mint call

;; Admin and contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var last-token-id uint u0)
(define-data-var mint-enabled bool true)

;; Maps for NFT data
(define-map nft-owners uint principal) ;; token-id -> owner
(define-map nft-metadata uint (tuple (origin (string-ascii 256)) (ingredients (string-ascii 1024)) (manufacturing-date uint) (expiration-date (optional uint)) (batch-size uint))) ;; token-id -> metadata
(define-map nft-flags uint (tuple (flagged bool) (reason (string-ascii 256)) (flagged-by principal) (flag-time uint))) ;; token-id -> flag info
(define-map nft-frozen uint bool) ;; token-id -> frozen status (e.g., for recalls)

;; Trait definition for SIP-009 NFT standard
(define-trait nft-trait
  (
    (get-last-token-id () (response uint uint))
    (get-token-uri (uint) (response (optional (string-ascii 256)) uint))
    (get-owner (uint) (response (optional principal) uint))
    (transfer (uint principal principal) (response bool uint))
  )
)

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: ensure mint enabled
(define-private (ensure-mint-enabled)
  (asserts! (var-get mint-enabled) (err ERR-NOT-AUTHORIZED))
)

;; Private helper: validate metadata
(define-private (validate-metadata (metadata (tuple (origin (string-ascii 256)) (ingredients (string-ascii 1024)) (manufacturing-date uint) (expiration-date (optional uint)) (batch-size uint))))
  (and
    (> (len (get origin metadata)) u0)
    (> (len (get ingredients metadata)) u0)
    (> (get manufacturing-date metadata) u0)
    (> (get batch-size metadata) u0)
  )
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin tx-sender)) (err ERR-ZERO-ADDRESS)) ;; Prevent self-transfer or zero-like
    (var-set admin new-admin)
    (ok true)
  )
)

;; Pause/unpause the contract
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set paused pause)
    (ok pause)
  )
)

;; Enable/disable minting
(define-public (set-mint-enabled (enabled bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set mint-enabled enabled)
    (ok enabled)
  )
)

;; Mint a new NFT batch
(define-public (mint (metadata (tuple (origin (string-ascii 256)) (ingredients (string-ascii 1024)) (manufacturing-date uint) (expiration-date (optional uint)) (batch-size uint))))
  (begin
    (ensure-not-paused)
    (ensure-mint-enabled)
    (asserts! (validate-metadata metadata) (err ERR-INVALID-METADATA))
    (let ((new-id (+ (var-get last-token-id) u1)))
      (map-set nft-owners new-id tx-sender)
      (map-set nft-metadata new-id metadata)
      (map-set nft-flags new-id {flagged: false, reason: "", flagged-by: tx-sender, flag-time: u0})
      (map-set nft-frozen new-id false)
      (var-set last-token-id new-id)
      (print {event: "mint", token-id: new-id, owner: tx-sender, metadata: metadata}) ;; Emulate event
      (ok new-id)
    )
  )
)

;; Batch mint (up to MAX-MINT-PER-BATCH)
(define-public (batch-mint (metadatas (list 1000 (tuple (origin (string-ascii 256)) (ingredients (string-ascii 1024)) (manufacturing-date uint) (expiration-date (optional uint)) (batch-size uint)))))
  (begin
    (ensure-not-paused)
    (ensure-mint-enabled)
    (asserts! (<= (len metadatas) MAX-MINT-PER-BATCH) (err ERR-MAX-MINT-LIMIT))
    (fold mint-iter metadatas (ok u0))
  )
)

;; Iterator for batch mint
(define-private (mint-iter (metadata (tuple (origin (string-ascii 256)) (ingredients (string-ascii 1024)) (manufacturing-date uint) (expiration-date (optional uint)) (batch-size uint))) (prev (response uint uint)))
  (match prev
    success (mint metadata)
    error prev
  )
)

;; Burn an NFT (only owner or admin)
(define-public (burn (token-id uint))
  (begin
    (ensure-not-paused)
    (let ((owner (unwrap! (map-get? nft-owners token-id) (err ERR-NFT-NOT-EXISTS))))
      (asserts! (or (is-eq tx-sender owner) (is-admin)) (err ERR-NOT-OWNER))
      (map-delete nft-owners token-id)
      (map-delete nft-metadata token-id)
      (map-delete nft-flags token-id)
      (map-delete nft-frozen token-id)
      (print {event: "burn", token-id: token-id, owner: owner})
      (ok true)
    )
  )
)

;; Transfer NFT (SIP-009 compliant)
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  (begin
    (ensure-not-paused)
    (asserts! (is-eq tx-sender sender) (err ERR-NOT-OWNER)) ;; Ensure sender is caller
    (let ((owner (unwrap! (map-get? nft-owners token-id) (err ERR-NFT-NOT-EXISTS)))
          (frozen (default-to false (map-get? nft-frozen token-id))))
      (asserts! (is-eq owner sender) (err ERR-NOT-OWNER))
      (asserts! (not frozen) (err ERR-TRANSFER-FROZEN))
      (asserts! (not (is-eq recipient tx-sender)) (err ERR-ZERO-ADDRESS)) ;; No zero addr
      (map-set nft-owners token-id recipient)
      (print {event: "transfer", token-id: token-id, from: sender, to: recipient})
      (ok true)
    )
  )
)

;; Flag NFT for recall (admin only)
(define-public (flag-for-recall (token-id uint) (reason (string-ascii 256)))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (let ((flag (default-to {flagged: false, reason: "", flagged-by: tx-sender, flag-time: u0} (map-get? nft-flags token-id))))
      (asserts! (not (get flagged flag)) (err ERR-ALREADY-FLAGGED))
      (map-set nft-flags token-id {flagged: true, reason: reason, flagged-by: tx-sender, flag-time: block-height})
      (map-set nft-frozen token-id true) ;; Freeze transfers
      (print {event: "flag", token-id: token-id, reason: reason})
      (ok true)
    )
  )
)

;; Unflag NFT (admin only)
(define-public (unflag (token-id uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (let ((flag (unwrap! (map-get? nft-flags token-id) (err ERR-NFT-NOT-EXISTS))))
      (asserts! (get flagged flag) (err ERR-FLAG-NOT-ALLOWED))
      (map-set nft-flags token-id {flagged: false, reason: "", flagged-by: tx-sender, flag-time: u0})
      (map-set nft-frozen token-id false)
      (print {event: "unflag", token-id: token-id})
      (ok true)
    )
  )
)

;; Read-only: get last token ID (SIP-009)
(define-read-only (get-last-token-id)
  (ok (var-get last-token-id))
)

;; Read-only: get token URI (SIP-009, but since metadata is on-chain, return a dummy or construct)
(define-read-only (get-token-uri (token-id uint))
  (ok (some (concat "ipfs://foodtrace/metadata/" (int-to-ascii token-id)))) ;; Placeholder
)

;; Read-only: get owner (SIP-009)
(define-read-only (get-owner (token-id uint))
  (ok (map-get? nft-owners token-id))
)

;; Read-only: get metadata
(define-read-only (get-metadata (token-id uint))
  (ok (map-get? nft-metadata token-id))
)

;; Read-only: get flag info
(define-read-only (get-flag (token-id uint))
  (ok (map-get? nft-flags token-id))
)

;; Read-only: is frozen
(define-read-only (is-frozen (token-id uint))
  (ok (default-to false (map-get? nft-frozen token-id)))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: is paused
(define-read-only (is-paused)
  (ok (var-get paused))
)

;; Read-only: is mint enabled
(define-read-only (is-mint-enabled)
  (ok (var-get mint-enabled))
)
# FoodTrace

A blockchain-powered food traceability platform that ensures transparency, safety, and accountability in food manufacturing supply chains — solving real-world issues like counterfeit products, inefficient recalls, and lack of sourcing visibility, all on-chain.

---

## Overview

FoodTrace consists of four main smart contracts that together form a decentralized, transparent, and secure ecosystem for food manufacturers, suppliers, and consumers:

1. **BatchNFT Contract** – Issues and manages NFTs representing unique food batches for traceability.
2. **SupplyChainTracker Contract** – Records and verifies supply chain events from farm to shelf.
3. **QualityOracle Contract** – Integrates off-chain data for quality checks and certifications.
4. **StakeholderDAO Contract** – Enables governance for standards, disputes, and incentives.

---

## Features

- **Batch NFTs** for immutable product identification and ownership tracking  
- **End-to-end supply chain logging** with timestamped events  
- **Oracle-based verifications** for real-world data like inspections and lab results  
- **DAO governance** for collaborative decision-making on industry standards  
- **Automated recall mechanisms** triggered by quality issues  
- **Consumer scanning** for instant product history verification  
- **Incentive rewards** for compliant suppliers and manufacturers  
- **Anti-counterfeit measures** through on-chain provenance  

---

## Smart Contracts

### BatchNFT Contract
- Mint NFTs for each food batch with metadata (e.g., origin, ingredients, manufacturing date)
- Transfer ownership along the supply chain
- Burn or flag NFTs for recalls or expirations

### SupplyChainTracker Contract
- Log events like sourcing, processing, packaging, and distribution
- Enforce sequential verification (e.g., can't ship without quality approval)
- Queryable history for audits and consumer access

### QualityOracle Contract
- Secure integration with off-chain oracles for data like lab tests, certifications (e.g., organic, GMO-free)
- Automated triggers for alerts on quality failures
- Data update mechanisms with multi-signature approvals

### StakeholderDAO Contract
- Token-weighted voting for protocol updates, dispute resolutions, and reward distributions
- Incentive pools for participants (e.g., bonuses for transparent suppliers)
- Quorum-based execution of proposals

---

## Installation

1. Install [Clarinet CLI](https://docs.hiro.so/clarinet/getting-started)
2. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/foodtrace.git
   ```
3. Run tests:
    ```bash
    npm test
    ```
4. Deploy contracts:
    ```bash
    clarinet deploy
    ```

## Usage

Each smart contract operates independently but integrates with others for a complete food traceability experience.
Refer to individual contract documentation for function calls, parameters, and usage examples.

## License

MIT License
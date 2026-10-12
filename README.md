# TrustGov — Verifiable Government Officer Identity

**TrustGov** is a prototype security platform designed to help citizens verify the identity of people claiming to be government officials and identify suspicious or unauthorized requests.

It combines decentralized identifiers (DIDs), digitally signed verifiable credentials, cryptographic challenge-response verification, and blockchain-based integrity anchoring to demonstrate a safer approach to official identity verification.

> **Project status:** Prototype for demonstration and evaluation. TrustGov is not an officially endorsed government service and is not yet integrated with real government identity systems.

## The Problem

Scammers may impersonate officials from agencies such as the police, CBI, or Enforcement Directorate to threaten citizens, demand money, or obtain sensitive information.

TrustGov demonstrates how citizens can independently verify an officer's registered identity and evaluate whether a requested action is authorized.

## Key Features

- **Digital identity verification:** Prototype decentralized identifiers (DIDs) for registered officers.
- **Verifiable credentials:** W3C-aligned credentials signed using Ed25519 cryptography.
- **Proof of possession:** Challenge-response verification to demonstrate control of a registered signing key.
- **Blockchain integrity anchoring:** SHA-256 hashes anchored through a smart contract.
- **Citizen verification portal:** Demonstration flows for officer codes, credential identifiers, DIDs, and QR-based verification.
- **Authorization and risk evaluation:** Evaluates requested actions and can deny high-risk requests, such as demands for UPI payments.
- **Scam reporting:** Incident reports and evidence-integrity checks using cryptographic hashes.
- **IVR demonstration:** A simulated phone-menu experience designed to explore accessibility for citizens without smartphones.
- **Security controls:** Authentication, role-based access control, input validation, security headers, and automated tests.

## How It Works

1. **Register an officer:** An authorized administrator registers a fictional or test officer in the prototype.
2. **Issue credentials:** The system associates the officer with a DID and issues a digitally signed credential.
3. **Verify identity:** A citizen uses the verification portal to check the officer's credential and cryptographic proof.
4. **Evaluate the request:** The authorization engine evaluates the requested action separately from the officer's identity.
5. **Report suspicious activity:** Citizens can submit a report and preserve evidence for integrity checking.

**Important:** A verified identity does not automatically make every request legitimate. Citizens should not transfer money, disclose OTPs, share passwords, or provide banking credentials merely because someone claims to be a verified officer.

## Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL / Supabase-compatible configuration, with a development in-memory fallback |
| Digital identity | Prototype DID identifiers, Ed25519 |
| Credentials | W3C-aligned Verifiable Credentials |
| Blockchain | Solidity, Hardhat, Ethers |
| Security | JWT authentication, role-based access, SHA-256 integrity checks |
| Testing | Automated backend/frontend tests and browser-based verification |
| Deployment preparation | Docker and Docker Compose |

## Architecture

```text
Citizen / Administrator
          |
          v
    React Frontend
          |
          v
   Express API Backend
          |
          +---- Authentication and Access Control
          |
          +---- DID and Credential Verification
          |
          +---- Authorization and Risk Evaluation
          |
          +---- Scam Reports and Evidence Integrity
          |
          +---- Database / Development Storage
          |
          +---- Smart Contract Registry
          |
          +---- Simulated IVR
```

## Project Structure

```text
TrustGov/
├── backend/       # Express API, services, security, and tests
├── frontend/      # React application and citizen/admin interfaces
├── blockchain/    # Smart contracts and Hardhat configuration
├── database/      # Database schemas and migrations
├── docs/           # Technical documentation and security notes
├── docs/presentation/
│   ├── TRUSTGOV_PROJECT_PRESENTATION.md
│   ├── TRUSTGOV_PROJECT_PRESENTATION.html
│   ├── TRUSTGOV_SLIDES_VIEWER.html
│   ├── TRUSTGOV_5_MINUTE_SCRIPT.md
│   ├── TRUSTGOV_DEMO_SCRIPT.md
│   ├── TRUSTGOV_EVALUATOR_QA.md
│   └── TRUSTGOV_HANDOVER.md
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .env.production.example
└── README.md
```

## Getting Started

### Prerequisites

Install the following before running the project:

- Node.js and npm
- Git
- A code editor such as Antigravity or Visual Studio Code
- Docker, if you intend to use the container setup

### 1. Clone the repository

```bash
git clone https://github.com/kothamanishkumar2006-netizen/TrustGov.git
cd TrustGov
```

### 2. Install dependencies

Check the root, `backend/`, `frontend/`, and `blockchain/` directories for their respective `package.json` files. Install dependencies in each project directory that has its own package manifest.

```bash
npm install
```

Run this command from the root only if the root `package.json` defines the appropriate install workflow. Otherwise, install dependencies separately in the relevant directories.

### 3. Configure environment variables

Use the example environment files as references:

```text
.env.example
.env.production.example
```

Create the required local environment files and configure the values needed for your selected development setup.

**Never commit real credentials**, including database passwords, Supabase service-role keys, JWT secrets, RPC provider API keys, or blockchain private keys. Keep `.env` files and private key material out of Git.

### 4. Start the application

Follow the scripts defined in the relevant `package.json` files and the project documentation to start the backend, frontend, database, and local blockchain components.

For local development, the API has used port `5000` and the Vite frontend has used port `5173`. These ports may differ depending on your configuration.

If a port is already in use, stop the existing development process or configure a different port before restarting the application.

### 5. Run tests

Run the test scripts defined in the root and individual component `package.json` files. Review the test output and resolve failures before demonstrating the application.

## Security and Privacy

- Keep personal information and private signing keys off-chain.
- Use cryptographic hashes for integrity checks rather than publishing sensitive evidence.
- Never trust a caller solely because they possess an officer's name, photograph, badge number, or verified credential.
- Keep authentication secrets in environment variables or a suitable secrets manager.
- Use managed key custody, secure database configuration, HTTPS, monitoring, and production-grade access controls before any real deployment.
- Do not use fictional demo officers or test credentials as proof of real government authorization.

## Current Limitations

This is a demonstration prototype. Depending on the selected local configuration:

- The DID method is a prototype and is not a registered DID method.
- Blockchain operations may use a local Hardhat network.
- Database storage may use an in-memory fallback.
- The IVR implementation is simulated and does not, by itself, connect to the public telephone network.
- Real government agency integrations, production key-management infrastructure, and live telephony integrations are not configured by default.

A successful local demonstration or automated test run does not establish production readiness.

## Documentation

Presentation materials, the demo walkthrough, evaluator questions, and handover documentation are available in `docs/presentation/`. Additional technical and security documentation is available in `docs/`.

## Contributing

1. Create a branch for your changes.
2. Make focused changes.
3. Run the relevant tests.
4. Review changes for accidentally included credentials or sensitive data.
5. Submit a pull request describing the changes.

## License

No license has been specified yet. Unless a license is added to this repository, do not assume that the project is available for unrestricted reuse or redistribution.

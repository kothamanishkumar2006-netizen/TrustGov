import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("================================================================");
  console.log("TRUSTGOV - PHASE 5: SMART CONTRACT DEPLOYMENT");
  console.log("================================================================");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying TrustGovRegistry with account: ${deployer.address}`);

  const TrustGovRegistryFactory = await ethers.getContractFactory("TrustGovRegistry");
  const registry = await TrustGovRegistryFactory.deploy();
  await registry.waitForDeployment();

  const contractAddress = await registry.getAddress();
  const deploymentTx = registry.deploymentTransaction();
  const txHash = deploymentTx ? deploymentTx.hash : "N/A";
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log(`\n Contract Deployed Successfully!`);
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Deployment Tx Hash: ${txHash}`);
  console.log(`Network Name: ${network.name}`);
  console.log(`Chain ID: ${chainId.toString()}`);
  console.log("================================================================\n");

  // Save deployment artifact for backend consumption
  const deploymentInfo = {
    contractAddress,
    transactionHash: txHash,
    network: network.name,
    chainId: Number(chainId),
    deployedAt: new Date().toISOString(),
    deployerAddress: deployer.address
  };

  const outputPath = path.resolve(__dirname, "../deployed-registry.json");
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));

  // Also mirror to backend config directory
  const backendConfigPath = path.resolve(__dirname, "../../backend/src/config/deployed-registry.json");
  fs.writeFileSync(backendConfigPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment metadata saved to: ${backendConfigPath}`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});

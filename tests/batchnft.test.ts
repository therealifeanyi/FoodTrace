 
import { describe, it, expect, beforeEach } from "vitest";

interface Metadata {
	origin: string;
	ingredients: string;
	manufacturingDate: bigint;
	expirationDate: bigint | null;
	batchSize: bigint;
}

interface Flag {
	flagged: boolean;
	reason: string;
	flaggedBy: string;
	flagTime: bigint;
}

const mockContract = {
	admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM" as string,
	paused: false as boolean,
	lastTokenId: 0n as bigint,
	mintEnabled: true as boolean,
	owners: new Map<bigint, string>(),
	metadata: new Map<bigint, Metadata>(),
	flags: new Map<bigint, Flag>(),
	frozen: new Map<bigint, boolean>(),

	isAdmin(caller: string): boolean {
		return caller === this.admin;
	},

	setPaused(
		caller: string,
		pause: boolean
	): { value: boolean } | { error: number } {
		if (!this.isAdmin(caller)) return { error: 100 };
		this.paused = pause;
		return { value: pause };
	},

	setMintEnabled(
		caller: string,
		enabled: boolean
	): { value: boolean } | { error: number } {
		if (!this.isAdmin(caller)) return { error: 100 };
		this.mintEnabled = enabled;
		return { value: enabled };
	},

	mint(caller: string, meta: Metadata): { value: bigint } | { error: number } {
		if (this.paused) return { error: 104 };
		if (!this.mintEnabled) return { error: 100 };
		// Validate metadata (simplified)
		if (
			meta.origin.length === 0 ||
			meta.ingredients.length === 0 ||
			meta.manufacturingDate <= 0n ||
			meta.batchSize <= 0n
		) {
			return { error: 106 };
		}
		const newId = this.lastTokenId + 1n;
		this.owners.set(newId, caller);
		this.metadata.set(newId, meta);
		this.flags.set(newId, {
			flagged: false,
			reason: "",
			flaggedBy: caller,
			flagTime: 0n,
		});
		this.frozen.set(newId, false);
		this.lastTokenId = newId;
		return { value: newId };
	},

	transfer(
		caller: string,
		tokenId: bigint,
		sender: string,
		recipient: string
	): { value: boolean } | { error: number } {
		if (this.paused) return { error: 104 };
		if (caller !== sender) return { error: 101 };
		const owner = this.owners.get(tokenId);
		if (!owner || owner !== sender) return { error: 101 };
		const isFrozen = this.frozen.get(tokenId) ?? false;
		if (isFrozen) return { error: 109 };
		this.owners.set(tokenId, recipient);
		return { value: true };
	},

	burn(
		caller: string,
		tokenId: bigint
	): { value: boolean } | { error: number } {
		if (this.paused) return { error: 104 };
		const owner = this.owners.get(tokenId);
		if (!owner) return { error: 102 };
		if (caller !== owner && !this.isAdmin(caller)) return { error: 101 };
		this.owners.delete(tokenId);
		this.metadata.delete(tokenId);
		this.flags.delete(tokenId);
		this.frozen.delete(tokenId);
		return { value: true };
	},

	flagForRecall(
		caller: string,
		tokenId: bigint,
		reason: string
	): { value: boolean } | { error: number } {
		if (!this.isAdmin(caller)) return { error: 100 };
		const flag = this.flags.get(tokenId);
		if (!flag || flag.flagged) return { error: 103 };
		this.flags.set(tokenId, {
			...flag,
			flagged: true,
			reason,
			flaggedBy: caller,
			flagTime: 100n,
		}); // Mock block-height
		this.frozen.set(tokenId, true);
		return { value: true };
	},

	unflag(
		caller: string,
		tokenId: bigint
	): { value: boolean } | { error: number } {
		if (!this.isAdmin(caller)) return { error: 100 };
		const flag = this.flags.get(tokenId);
		if (!flag || !flag.flagged) return { error: 108 };
		this.flags.set(tokenId, {
			flagged: false,
			reason: "",
			flaggedBy: caller,
			flagTime: 0n,
		});
		this.frozen.set(tokenId, false);
		return { value: true };
	},

	getLastTokenId(): { value: bigint } {
		return { value: this.lastTokenId };
	},

	getOwner(tokenId: bigint): { value: string | undefined } {
		return { value: this.owners.get(tokenId) };
	},

	getMetadata(tokenId: bigint): { value: Metadata | undefined } {
		return { value: this.metadata.get(tokenId) };
	},

	getFlag(tokenId: bigint): { value: Flag | undefined } {
		return { value: this.flags.get(tokenId) };
	},

	isFrozen(tokenId: bigint): { value: boolean } {
		return { value: this.frozen.get(tokenId) ?? false };
	},
};

describe("FoodTrace BatchNFT", () => {
	beforeEach(() => {
		mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
		mockContract.paused = false;
		mockContract.lastTokenId = 0n;
		mockContract.mintEnabled = true;
		mockContract.owners = new Map();
		mockContract.metadata = new Map();
		mockContract.flags = new Map();
		mockContract.frozen = new Map();
	});

	it("should mint a new NFT when conditions are met", () => {
		const meta: Metadata = {
			origin: "Farm A",
			ingredients: "Wheat, Sugar",
			manufacturingDate: 1627849200n,
			expirationDate: null,
			batchSize: 100n,
		};
		const result = mockContract.mint(
			"ST2CY5V39NHDP5P0RZ21ATQ79KC29N0WRRK553G7V",
			meta
		);
		expect(result).toEqual({ value: 1n });
		expect(mockContract.owners.get(1n)).toBe(
			"ST2CY5V39NHDP5P0RZ21ATQ79KC29N0WRRK553G7V"
		);
		expect(mockContract.metadata.get(1n)).toEqual(meta);
	});

	it("should prevent minting with invalid metadata", () => {
		const meta: Metadata = {
			origin: "",
			ingredients: "Wheat",
			manufacturingDate: 0n,
			expirationDate: null,
			batchSize: 100n,
		};
		const result = mockContract.mint(
			"ST2CY5V39NHDP5P0RZ21ATQ79KC29N0WRRK553G7V",
			meta
		);
		expect(result).toEqual({ error: 106 });
	});

	it("should transfer NFT to new owner", () => {
		const meta: Metadata = {
			origin: "Farm A",
			ingredients: "Wheat, Sugar",
			manufacturingDate: 1627849200n,
			expirationDate: null,
			batchSize: 100n,
		};
		mockContract.mint("ST2CY5V39NHDP5P0RZ21ATQ79KC29N0WRRK553G7V", meta);
		const result = mockContract.transfer(
			"ST2CY5V39NHDP5P0RZ21ATQ79KC29N0WRRK553G7V",
			1n,
			"ST2CY5V39NHDP5P0RZ21ATQ79KC29N0WRRK553G7V",
			"ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP"
		);
		expect(result).toEqual({ value: true });
		expect(mockContract.owners.get(1n)).toBe(
			"ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP"
		);
	});

	it("should prevent transfer if frozen", () => {
		const meta: Metadata = {
			origin: "Farm A",
			ingredients: "Wheat, Sugar",
			manufacturingDate: 1627849200n,
			expirationDate: null,
			batchSize: 100n,
		};
		mockContract.mint("ST2CY5V39NHDP5P0RZ21ATQ79KC29N0WRRK553G7V", meta);
		mockContract.flagForRecall(
			mockContract.admin,
			1n,
			"Recall due to contamination"
		);
		const result = mockContract.transfer(
			"ST2CY5V39NHDP5P0RZ21ATQ79KC29N0WRRK553G7V",
			1n,
			"ST2CY5V39NHDP5P0RZ21ATQ79KC29N0WRRK553G7V",
			"ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP"
		);
		expect(result).toEqual({ error: 109 });
	});

	it("should burn NFT as owner", () => {
		const meta: Metadata = {
			origin: "Farm A",
			ingredients: "Wheat, Sugar",
			manufacturingDate: 1627849200n,
			expirationDate: null,
			batchSize: 100n,
		};
		mockContract.mint("ST2CY5V39NHDP5P0RZ21ATQ79KC29N0WRRK553G7V", meta);
		const result = mockContract.burn(
			"ST2CY5V39NHDP5P0RZ21ATQ79KC29N0WRRK553G7V",
			1n
		);
		expect(result).toEqual({ value: true });
		expect(mockContract.owners.has(1n)).toBe(false);
	});

	it("should flag NFT for recall as admin", () => {
		const meta: Metadata = {
			origin: "Farm A",
			ingredients: "Wheat, Sugar",
			manufacturingDate: 1627849200n,
			expirationDate: null,
			batchSize: 100n,
		};
		mockContract.mint("ST2CY5V39NHDP5P0RZ21ATQ79KC29N0WRRK553G7V", meta);
		const result = mockContract.flagForRecall(
			mockContract.admin,
			1n,
			"Contamination"
		);
		expect(result).toEqual({ value: true });
		const flag = mockContract.getFlag(1n).value;
		expect(flag?.flagged).toBe(true);
		expect(flag?.reason).toBe("Contamination");
		expect(mockContract.isFrozen(1n).value).toBe(true);
	});

	it("should unflag NFT as admin", () => {
		const meta: Metadata = {
			origin: "Farm A",
			ingredients: "Wheat, Sugar",
			manufacturingDate: 1627849200n,
			expirationDate: null,
			batchSize: 100n,
		};
		mockContract.mint("ST2CY5V39NHDP5P0RZ21ATQ79KC29N0WRRK553G7V", meta);
		mockContract.flagForRecall(mockContract.admin, 1n, "Contamination");
		const result = mockContract.unflag(mockContract.admin, 1n);
		expect(result).toEqual({ value: true });
		const flag = mockContract.getFlag(1n).value;
		expect(flag?.flagged).toBe(false);
		expect(mockContract.isFrozen(1n).value).toBe(false);
	});

	it("should not allow actions when paused", () => {
		mockContract.setPaused(mockContract.admin, true);
		const meta: Metadata = {
			origin: "Farm A",
			ingredients: "Wheat, Sugar",
			manufacturingDate: 1627849200n,
			expirationDate: null,
			batchSize: 100n,
		};
		const result = mockContract.mint(
			"ST2CY5V39NHDP5P0RZ21ATQ79KC29N0WRRK553G7V",
			meta
		);
		expect(result).toEqual({ error: 104 });
	});
});
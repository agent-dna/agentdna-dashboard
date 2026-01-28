export type NFTChainData = {
  BlockNo: number;
  BlockId: string;
  NFTData: string;
  NFTOwner: string;
  NFTValue: number;
  Epoch: number;
  TransactionID: string;
};

export type NFTListItem = {
  nft: string;
  owner_did: string;
  nft_value: number;
  nft_metadata: string;
  nft_file_name: string;
};

export type NFTListItemNew = {
  nft_id: string;
  nft_name: string;
};

export type NFTListResponse = {
  status: boolean;
  message: string;
  result: null;
  nfts: NFTListItem[];
};

export type NFTListResponseNew = {
  nfts: NFTListItemNew[];
};

export type NFTDataResponse = {
  status: boolean;
  message: string;
  result: null;
  NFTDataReply: NFTChainData[];
};

export type NFTRecord = {
  id: string;
  owner_did: string;
  nft_value: number;
  nft_metadata: string;
  nft_file_name: string;
  total_interactions?: number;
  intrusion_count?: number;
  agents_interacted?: number;
  nft_name?: string;
  chainData?: NFTChainData[];
};

export type ViewState = "dashboard" | "details" | "agent-info";

export type MetricCard = {
  label: string;
  value: string | number;
  color?: string;
};

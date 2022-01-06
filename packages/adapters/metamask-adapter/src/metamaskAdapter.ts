import detectEthereumProvider from "@metamask/detect-provider";
import {
  ADAPTER_CATEGORY,
  ADAPTER_CATEGORY_TYPE,
  ADAPTER_NAMESPACES,
  ADAPTER_STATUS,
  ADAPTER_STATUS_TYPE,
  AdapterInitOptions,
  AdapterNamespaceType,
  BaseAdapter,
  CHAIN_NAMESPACES,
  ChainNamespaceType,
  CustomChainConfig,
  getChainConfig,
  SafeEventEmitterProvider,
  UserInfo,
  WALLET_ADAPTERS,
  WalletInitializationError,
  WalletLoginError,
} from "@web3auth/base";

interface EthereumProvider extends SafeEventEmitterProvider {
  isMetaMask?: boolean;
  isConnected: () => boolean;
  chainId: string;
}

class MetamaskAdapter extends BaseAdapter<void> {
  readonly namespace: AdapterNamespaceType = ADAPTER_NAMESPACES.EIP155;

  readonly currentChainNamespace: ChainNamespaceType = CHAIN_NAMESPACES.EIP155;

  readonly type: ADAPTER_CATEGORY_TYPE = ADAPTER_CATEGORY.EXTERNAL;

  readonly name: string = WALLET_ADAPTERS.METAMASK;

  public status: ADAPTER_STATUS_TYPE = ADAPTER_STATUS.NOT_READY;

  // added after connecting
  public provider!: SafeEventEmitterProvider | null;

  private metamaskProvider!: EthereumProvider;

  constructor(adapterOptions: { chainConfig?: CustomChainConfig } = {}) {
    super();
    this.chainConfig = adapterOptions.chainConfig;
  }

  async init(options: AdapterInitOptions): Promise<void> {
    super.checkInitializationRequirements();
    this.metamaskProvider = (await detectEthereumProvider({ mustBeMetaMask: true })) as EthereumProvider;
    if (!this.metamaskProvider) throw WalletInitializationError.notInstalled("Metamask extension is not installed");
    this.status = ADAPTER_STATUS.READY;
    this.emit(ADAPTER_STATUS.READY, WALLET_ADAPTERS.METAMASK);
    try {
      if (options.autoConnect) {
        await this.connect();
      }
    } catch (error) {
      this.emit(ADAPTER_STATUS.ERRORED, error);
    }
  }

  setAdapterSettings(_: unknown): void {}

  async connect(): Promise<void> {
    super.checkConnectionRequirements();
    // set default to mainnet
    if (!this.chainConfig) this.chainConfig = getChainConfig(CHAIN_NAMESPACES.EIP155, 1);

    this.status = ADAPTER_STATUS.CONNECTING;
    this.emit(ADAPTER_STATUS.CONNECTING, { adapter: WALLET_ADAPTERS.METAMASK });
    if (!this.metamaskProvider) throw WalletLoginError.notConnectedError("Not able to connect with metamask");
    try {
      await this.metamaskProvider.request({ method: "eth_requestAccounts" });
      const { chainId } = this.metamaskProvider;
      if (chainId !== (this.chainConfig as CustomChainConfig).chainId) {
        await this.switchChain(this.chainConfig as CustomChainConfig);
      }
      this.status = ADAPTER_STATUS.CONNECTED;
      this.provider = this.metamaskProvider;
      this.provider.once("disconnect", () => {
        this.status = ADAPTER_STATUS.DISCONNECTED;
        this.emit(ADAPTER_STATUS.DISCONNECTED);
      });
      this.emit(ADAPTER_STATUS.CONNECTED, WALLET_ADAPTERS.METAMASK);
    } catch (error) {
      this.emit(ADAPTER_STATUS.ERRORED, error);
      this.status = ADAPTER_STATUS.READY;
      throw WalletLoginError.connectionError("Failed to login with metamask wallet");
    }
  }

  async disconnect(): Promise<void> {
    if (this.status !== ADAPTER_STATUS.CONNECTED) throw WalletLoginError.disconnectionError("Not connected with wallet");
    this.provider?.removeAllListeners();
    this.status = ADAPTER_STATUS.DISCONNECTED;
    this.emit(ADAPTER_STATUS.DISCONNECTED);
  }

  async getUserInfo(): Promise<Partial<UserInfo>> {
    if (this.status !== ADAPTER_STATUS.CONNECTED) throw WalletLoginError.notConnectedError("Not connected with wallet, Please login/connect first");
    return {};
  }

  private async switchChain(chainConfig: CustomChainConfig): Promise<void> {
    if (!this.metamaskProvider) throw WalletLoginError.notConnectedError("Not connected with wallet");
    try {
      await this.metamaskProvider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainConfig.chainId }],
      });
    } catch (switchError: unknown) {
      // This error code indicates that the chain has not been added to MetaMask.
      if ((switchError as any).code === 4902) {
        await this.metamaskProvider.request({
          method: "wallet_addEthereumChain",
          params: [{ chainId: chainConfig.chainId, chainName: chainConfig.displayName, rpcUrls: [chainConfig.rpcTarget] }],
        });
      } else {
        throw switchError;
      }
    }
  }
}

export { MetamaskAdapter };

<template>
  <div id="app">
    <h2>Login with Web3Auth and Polygon</h2>
    <Loader :isLoading="loading"></Loader>

    <section
      :style="{
        fontSize: '12px',
      }"
    >
      <button class="rpcBtn" v-if="!provider" @click="connect" style="cursor: pointer">Connect</button>
      <button class="rpcBtn" v-if="provider" @click="logout" style="cursor: pointer">Logout</button>
      <button class="rpcBtn" v-if="provider" @click="getUserInfo" style="cursor: pointer">Get User Info</button>
      <EthRpc :connectedAdapter="web3auth.connectedAdapterName" v-if="provider" :provider="provider" :console="console"></EthRpc>

      <!-- <button @click="showError" style="cursor: pointer">Show Error</button> -->
    </section>
    <div id="console" style="white-space: pre-line">
      <p style="white-space: pre-line"></p>
    </div>
  </div>
</template>

<script lang="ts">
import { ADAPTER_STATUS, CHAIN_NAMESPACES, CONNECTED_EVENT_DATA, CustomChainConfig, LoginMethodConfig } from "@web3auth/base";
import { CoinbaseAdapter } from "@web3auth/coinbase-adapter";
import { Web3Auth } from "@web3auth/modal";
import { OpenloginAdapter } from "@web3auth/openlogin-adapter";
import { TorusWalletConnectorPlugin } from "@web3auth/torus-wallet-connector-plugin";
import Vue from "vue";

import Loader from "@/components/loader.vue";
import EthRpc from "@/rpc/ethRpc.vue";

import config from "../config";
const polygonMumbaiConfig: CustomChainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  rpcTarget: "https://rpc-mumbai.maticvigil.com",
  blockExplorer: "https://mumbai-explorer.matic.today",
  chainId: "0x13881",
  displayName: "Polygon Mumbai Testnet",
  ticker: "matic",
  tickerName: "matic",
};

export default Vue.extend({
  name: "PolygonChain",
  props: {
    plugins: {
      type: Object,
      default: () => ({}),
    },
    adapterConfig: {
      type: Object,
    },
    openloginNetwork: {
      type: String,
      default: "testnet",
    },
  },
  watch: {
    adapterConfig: async function (newVal, oldVal) {
      // watch it
      console.log("Prop changed: ", newVal, " | was: ", oldVal);
      await this.initPolygonWeb3Auth();
    },
    openloginNetwork: async function (newVal, oldVal) {
      // watch it
      console.log("Prop changed: ", newVal, " | was: ", oldVal);
      await this.initEthAuth();
    },
  },
  data() {
    return {
      modalConfig: {},
      loading: false,
      loginButtonStatus: "",
      provider: undefined,
      web3auth: new Web3Auth({ chainConfig: { chainNamespace: CHAIN_NAMESPACES.EIP155 }, clientId: config.clientId }),
    };
  },
  components: {
    Loader,
    EthRpc,
  },
  async mounted() {
    console.log("polygon");
    await this.initPolygonWeb3Auth();
  },
  methods: {
    parseConfig() {
      this.adapterConfig.adapter.forEach((adapterConf) => {
        this.modalConfig[adapterConf.id] = {
          name: adapterConf.name,
          showOnModal: adapterConf.checked,
        };
        if (adapterConf.id === "openlogin") {
          const loginMethodsConfig: LoginMethodConfig = {};
          this.adapterConfig.login.forEach((loginProvider) => {
            loginMethodsConfig[loginProvider.id] = {
              name: loginProvider.name,
              showOnModal: loginProvider.checked,
            };
          });
          this.modalConfig[adapterConf.id] = {
            ...this.modalConfig[adapterConf.id],
            loginMethods: loginMethodsConfig,
          };
        }
      });
    },
    async initPolygonWeb3Auth() {
      console.log("polygon");
      this.parseConfig();
      try {
        this.loading = true;

        this.web3auth = new Web3Auth({ chainConfig: polygonMumbaiConfig, clientId: config.clientId, authMode: "DAPP" });
        const openloginAdapter = new OpenloginAdapter({
          adapterSettings: {
            network: this.openloginNetwork,
            clientId: config.clientId,
          },
        });
        const coinbaseAdapter = new CoinbaseAdapter({
          adapterSettings: { appName: "Web3Auth Example" },
        });

        this.web3auth.configureAdapter(coinbaseAdapter);

        this.web3auth.configureAdapter(openloginAdapter);
        if (this.plugins["torusWallet"]) {
          const torusPlugin = new TorusWalletConnectorPlugin({
            torusWalletOpts: {},
            walletInitOptions: {
              whiteLabel: {
                theme: { isDark: true, colors: { primary: "#00a8ff" } },
                logoDark: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
                logoLight: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
              },
              useWalletConnect: true,
              enableLogging: true,
            },
          });
          await this.web3auth.addPlugin(torusPlugin);
        }
        this.subscribeAuthEvents(this.web3auth);
        await this.web3auth.initModal({ modalConfig: this.modalConfig });
      } catch (error) {
        console.log("error", error);
        this.console("error", error);
      } finally {
        this.loading = false;
      }
    },
    subscribeAuthEvents(web3auth: Web3Auth) {
      web3auth.on(ADAPTER_STATUS.CONNECTED, (data: CONNECTED_EVENT_DATA) => {
        this.console("connected to wallet", data);
        this.provider = web3auth.provider;
        this.loginButtonStatus = "Logged in";
      });
      web3auth.on(ADAPTER_STATUS.CONNECTING, () => {
        this.console("connecting");
        this.loginButtonStatus = "Connecting...";
      });
      web3auth.on(ADAPTER_STATUS.DISCONNECTED, () => {
        this.console("disconnected");
        this.loginButtonStatus = "";
        this.provider = undefined;
      });
      web3auth.on(ADAPTER_STATUS.ERRORED, (error) => {
        console.log("error", error);
        this.console("errored", error);
        this.loginButtonStatus = "";
      });
    },
    async connect() {
      try {
        const provider = await this.web3auth.connect();
        this.provider = provider;
      } catch (error) {
        console.error(error);
        this.console("error", error);
      }
    },

    async logout() {
      await this.web3auth.logout();
      this.provider = undefined;
    },
    async getUserInfo() {
      const userInfo = await this.web3auth.getUserInfo();
      this.console(userInfo);
    },
    console(...args: unknown[]): void {
      const el = document.querySelector("#console>p");
      if (el) {
        el.innerHTML = JSON.stringify(args || {}, null, 2);
      }
    },
  },
});
</script>

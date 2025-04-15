import fs from "fs/promises";
import axios from "axios";
import { Command } from "commander";
const program = new Command();

program
  .name("nicoad-extractor (nade)")
  .description("ニコニコ動画の広告主を取得するCLIツール")
  .version("0.0.1", "-v, --version");

type History = {
  advertiserName: string;
  nicoadId: number;
  adPoint: number;
  contribution: number;
  startedAt: Date;
  endedAt: Date;
  userId: number;
};

type ApiResponse = {
  meta: {
    status: number;
  };
  data: {
    count: number;
    serverTime: Date;
    histories: History[];
  };
};

const fetchAllAdvertisers = async (videoId: string): Promise<History[]> => {
  const endpoint = `https://api.nicoad.nicovideo.jp/v1/contents/video/${videoId}/histories`;
  const limit = 100; // 任意。APIの仕様上、1回の取得数は適切な数に制限。
  let offset = 0;
  let allHistories: History[] = [];

  while (true) {
    const url = `${endpoint}?offset=${offset}&limit=${limit}`;
    const res = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res || !res.data) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const json: ApiResponse = await res.data;

    if (json.meta.status !== 200) {
      throw new Error(`API error! status: ${json.meta.status}`);
    }

    const histories = json.data.histories;
    allHistories = allHistories.concat(histories);

    if (histories.length < limit) {
      break; // これ以上データがないので終了
    }

    offset += limit;
  }

  return allHistories;
};

const parseVideoId = (videoId: string): string => {
  const match = videoId.match(/sm\d+/);
  if (match) {
    return match[0];
  } else {
    throw new Error("動画IDが無効です");
  }
};

program
  .command("list")
  .description("動画の広告主を取得")
  .argument("<videoId>", "動画ID or txtファイル")
  .option("--honorific <honorific>", "敬称")
  .option("-o, --output <file>", "ファイル出力")
  .option("-u, --unique", "ユニークな広告主のみを取得（複数動画の場合）")
  .action(async (videoId, options) => {
    const { honorific, output, unique } = options;
    let result = "";
    try {
      let uniqueAdvertisers: History[] = [];
      if (videoId.endsWith(".txt")) {
        const fileContent = await fs.readFile(videoId, "utf-8");
        const videoIds = fileContent
          .split("\n")
          .filter((id) => id.trim() !== "");
        if (unique) {
          const allAdvertisers: History[] = [];
          for (const id of videoIds) {
            const advertisers = await fetchAllAdvertisers(parseVideoId(id));
            allAdvertisers.push(...advertisers);
          }
          uniqueAdvertisers = Array.from(
            new Map(allAdvertisers.map((ad) => [ad.userId, ad])).values()
          );
          result += `広告主一覧（ユニーク）: ${uniqueAdvertisers.length}人\n`;
          uniqueAdvertisers.forEach((ad) => {
            if (honorific) {
              result += `${ad.advertiserName} ${honorific}\n`;
            } else {
              result += `${ad.advertiserName}\n`;
            }
          });
          console.log(result);
        } else {
          for (const id of videoIds) {
            const advertisers = await fetchAllAdvertisers(parseVideoId(id));
            uniqueAdvertisers = Array.from(
              new Map(advertisers.map((ad) => [ad.userId, ad])).values()
            );
            result += `動画ID: ${parseVideoId(id)}\n`;
            result += `広告主一覧（ユニーク）: ${uniqueAdvertisers.length}人\n`;
            uniqueAdvertisers.forEach((ad) => {
              if (honorific) {
                result += `${ad.advertiserName} ${honorific}\n`;
              } else {
                result += `${ad.advertiserName}\n`;
              }
            });
            result += "\n";
          }
          console.log(result);
        }
      } else {
        const advertisers = await fetchAllAdvertisers(parseVideoId(videoId));
        uniqueAdvertisers = Array.from(
          new Map(advertisers.map((ad) => [ad.userId, ad])).values()
        );
        result += `広告主一覧（ユニーク）: ${uniqueAdvertisers.length}人\n`;
        uniqueAdvertisers.forEach((ad) => {
          if (honorific) {
            result += `${ad.advertiserName} ${honorific}\n`;
          } else {
            result += `${ad.advertiserName}\n`;
          }
        });
        console.log(result);
      }
      if (output) {
        await fs.writeFile(output, result);
        console.log(`結果を${output}に保存しました`);
      }
    } catch (err) {
      console.error("取得中にエラーが発生しました:", err);
    }
  });

program.parse();

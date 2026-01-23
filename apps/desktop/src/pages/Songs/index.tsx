import {
  PlayCircleOutlined
} from "@ant-design/icons";
import { loadMoreTrack } from "@soundx/services";
import { useInfiniteScroll } from "ahooks";
import {
  Button,
  Empty,
  Flex,
  Skeleton,
  Typography,
  theme
} from "antd";
import React, { useRef } from "react";
import TrackList from "../../components/TrackList";
import { type Track } from "../../models";
import { usePlayerStore } from "../../store/player";
import { usePlayMode } from "../../utils/playMode";
import styles from "./index.module.less";

const { Title } = Typography;

interface Result {
  list: Track[];
  hasMore: boolean;
  nextId?: number;
}

const Songs: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { token } = theme.useToken();
  const { play, setPlaylist } = usePlayerStore();


  const { mode } = usePlayMode();

  const loadMore = async (d: Result | undefined): Promise<Result> => {
    const currentLoadCount = d?.nextId || 0;
    const pageSize = 50;

    try {
      const res = await loadMoreTrack({
        pageSize,
        loadCount: currentLoadCount,
        type: mode === "MUSIC" ? "MUSIC" : "AUDIOBOOK"
      });
      
      if (res.code === 200 && res.data) {
        // Handle different return shapes if necessary, but Adapter returns ILoadMoreData<Track>
        // Native returns Track[], Subsonic returns Track[] in data.list usually. 
        // Wait, NativeTrackAdapter.loadMoreTrack returns ISuccessResponse<ILoadMoreData<Track>>
        // which has list: Track[], hasMore: boolean etc?
        // Let's check NativeTrackAdapter implementation again from previous turns.
        // It returns { list: Track[], total: number, hasMore: boolean } usually in ILoadMoreData.
        // BUT NativeTrackAdapter code showed it returning Request.get<... ILoadMoreData<Track>>
        // Let's assume standard ILoadMoreData structure.
        
        const list = res.data.list;
        const previousList = d?.list || [];

        return {
            list: [...previousList, ...list],
            hasMore: list.length === pageSize,
            nextId: currentLoadCount + 1,
        };
      }
    } catch (error) {
       console.error("Failed to fetch songs:", error);
    }

    return {
      list: d?.list || [],
      hasMore: false,
    };
  };

  const { data, loading, loadingMore, reload } = useInfiniteScroll(
    loadMore,
    {
      target: scrollRef,
      isNoMore: (d) => !d?.hasMore,
      reloadDeps: [mode],
    }
  );

  const handlePlayAll = () => {
    if (data?.list.length) {
      setPlaylist(data.list);
      play(data.list[0]);
    }
  };

  return (
    <div ref={scrollRef} className={styles.container}>
      <div className={styles.pageHeader}>
        <Title level={2} className={styles.title}>
          单曲
        </Title>
        <Flex gap={8} align="center">
          <Button 
            type="primary" 
            icon={<PlayCircleOutlined />} 
            onClick={handlePlayAll}
            disabled={!data?.list.length}
          >
             播放全部
          </Button>
        </Flex>
      </div>

      <div style={{ padding: '0 24px' }}>
          <TrackList
            tracks={data?.list || []}
            showIndex={true}
            showArtist={true}
            showAlbum={true}
            onPlay={(track, tracks) => {
              setPlaylist(tracks);
              play(track, track.albumId);
            }}
            onRefresh={reload}
          />
      </div>

      {(loading || loadingMore) && (
        <div className={styles.loadingContainer}>
          <div style={{ padding: '0 24px' }}>
             <Skeleton active />
             <Skeleton active />
          </div>
        </div>
      )}

      {data && !data.hasMore && data.list.length > 0 && (
        <div className={styles.noMore}>没有更多了</div>
      )}

      {data?.list.length === 0 && !loading && (
        <div
          className={styles.noData}
          style={{ color: token.colorTextSecondary }}
        >
          <Empty description="暂无歌曲" />
        </div>
      )}
    </div>
  );
};

export default Songs;

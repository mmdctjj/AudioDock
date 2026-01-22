import {
  AppstoreOutlined,
  SyncOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { getFavoriteAlbums, getFavoriteTracks } from "@soundx/services";
import { useInfiniteScroll } from "ahooks";
import {
  Button,
  Col,
  Empty,
  Flex,
  Row,
  Segmented,
  Skeleton,
  Timeline,
  Typography,
  theme,
} from "antd";
import React, { useRef, useState } from "react";
import Cover from "../../components/Cover/index";
import TrackList from "../../components/TrackList";
import type { TimelineItem } from "../../models";
import { type Album, type Track } from "../../models";
import { useAuthStore } from "../../store/auth";
import { usePlayerStore } from "../../store/player";
import { usePlayMode } from "../../utils/playMode";
import { formatTimeLabel } from "../../utils/timeFormat";
import styles from "./index.module.less";

const { Title } = Typography;

interface Result {
  list: TimelineItem[];
  hasMore: boolean;
  nextId?: number;
}

const Favorites: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"album" | "track">("album");
  const { token } = theme.useToken();
  const { play, setPlaylist } = usePlayerStore();

  const { user } = useAuthStore();

  const { mode } = usePlayMode();
  const type = mode;

  const loadMoreFavorites = async (d: Result | undefined): Promise<Result> => {
    const currentLoadCount = d?.nextId || 0;

    try {
      if (viewMode === "album") {
        const res = await getFavoriteAlbums(
          user?.id || 0,
          currentLoadCount,
          20
        );
        if (res.code === 200 && res.data) {
          const { list } = res.data;

          console.log(list);

          // Group by date
          const timelineMap = new Map<string, Album[]>();
          list.forEach((item: any) => {
            const dateKey = new Date(item.createdAt).toDateString();
            if (!timelineMap.has(dateKey)) {
              timelineMap.set(dateKey, []);
            }
            if (item.album) {
              timelineMap.get(dateKey)!.push(item.album);
            }
          });

          const newItems: TimelineItem[] = Array.from(
            timelineMap.entries()
          ).map(([date, albums]) => ({
            id: date,
            time: new Date(date).getTime(),
            items: albums?.filter((album) => album.type === type),
          }));

          // Merge with existing items if date matches
          let mergedList = d ? [...d.list] : [];
          newItems.forEach((newItem) => {
            const existingItemIndex = mergedList.findIndex(
              (item) => item.id === newItem.id
            );
            if (existingItemIndex > -1) {
              mergedList[existingItemIndex].items = [
                ...mergedList[existingItemIndex].items,
                ...newItem.items,
              ];
            } else {
              mergedList.push(newItem);
            }
          });

          if (!d) mergedList = newItems;

          return {
            list: mergedList,
            hasMore: list.length === 20,
            nextId: currentLoadCount + 1,
          };
        }
      } else {
        // Track mode
        const res = await getFavoriteTracks(
          user?.id || 0,
          currentLoadCount,
          20
        );
        if (res.code === 200 && res.data) {
          const { list, total: _total } = res.data;

          const timelineMap = new Map<string, Track[]>();
          list.forEach((item: any) => {
            const dateKey = new Date(item.createdAt).toDateString();
            if (!timelineMap.has(dateKey)) {
              timelineMap.set(dateKey, []);
            }
            if (item.track) {
              timelineMap.get(dateKey)!.push(item.track);
            }
          });

          const newItems: TimelineItem[] = Array.from(
            timelineMap.entries()
          ).map(([date, tracks]) => ({
            id: date,
            time: new Date(date).getTime(),
            items: tracks?.filter((track) => track.type === type),
          }));

          // Merge with existing items if date matches
          let mergedList = d ? [...d.list] : [];
          newItems.forEach((newItem) => {
            const existingItemIndex = mergedList.findIndex(
              (item) => item.id === newItem.id
            );
            if (existingItemIndex > -1) {
              mergedList[existingItemIndex].items = [
                ...mergedList[existingItemIndex].items,
                ...newItem.items,
              ];
            } else {
              mergedList.push(newItem);
            }
          });

          if (!d) mergedList = newItems;

          return {
            list: mergedList,
            hasMore: list.length === 20,
            nextId: currentLoadCount + 1,
          };
        }
      }
    } catch (error) {
      console.error("Failed to fetch favorites:", error);
    }

    return {
      list: d?.list || [],
      hasMore: false,
    };
  };

  const { data, loading, loadingMore, reload } = useInfiniteScroll(
    loadMoreFavorites,
    {
      target: scrollRef,
      isNoMore: (d) => !d?.hasMore,
      reloadDeps: [viewMode, type],
    }
  );

  console.log(data);

  const handleRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const timelineItems =
    data?.list.map((item) => ({
      children: (
        <div>
          <Title level={4} className={styles.timelineTitle}>
            {formatTimeLabel(item.time)}
          </Title>
          {viewMode === "album" ? (
            <Row gutter={16}>
              {item.items.map((album) => (
                <Col key={album.id}>
                  <Cover item={album as Album} />
                </Col>
              ))}
            </Row>
          ) : (
            <TrackList
              tracks={item.items as Track[]}
              showIndex={false}
              showArtist={true}
              showAlbum={true}
              onPlay={(track, tracks) => {
                setPlaylist(tracks);
                play(track, -1);
              }}
              // Refresh on delete/like?
              // If we delete from Favorites, we should probably reload.
              onRefresh={reload}
            />
          )}
        </div>
      ),
    })) || [];

  return (
    <div ref={scrollRef} className={styles.container}>
      <div className={styles.pageHeader}>
        <Title level={2} className={styles.title}>
          收藏
        </Title>
        <Flex gap={8} align="center">
          {type === "MUSIC" && (
            <Segmented
              options={[
                { value: "album", icon: <AppstoreOutlined />, label: "专辑" },
                {
                  value: "track",
                  icon: <UnorderedListOutlined />,
                  label: "歌曲",
                },
              ]}
              value={viewMode}
              onChange={(value) => setViewMode(value as "album" | "track")}
            />
          )}
          <Button
            type="text"
            icon={<SyncOutlined spin={refreshing} />}
            onClick={handleRefresh}
            loading={refreshing}
            className={styles.refreshButton}
          >
            刷新
          </Button>
        </Flex>
      </div>

      <Timeline mode="left" items={timelineItems} className={styles.timeline} />

      {(loading || loadingMore) && (
        <div className={styles.loadingContainer}>
          <Skeleton
            active
            title={{ width: "100px" }}
            paragraph={false}
            className={styles.skeletonTitle}
          />
          <Row gutter={[24, 24]}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Col key={`skeleton-${index}`}>
                <Cover.Skeleton />
              </Col>
            ))}
          </Row>
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
          <Empty description="暂无收藏" />
        </div>
      )}
    </div>
  );
};

export default Favorites;

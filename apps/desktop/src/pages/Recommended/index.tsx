import { SettingOutlined, SyncOutlined } from "@ant-design/icons";
import {
  getLatestArtists,
  getLatestTracks,
  getRecentAlbums,
  getRecommendedAlbums,
} from "@soundx/services";
import { useDebounceFn } from "ahooks";
import { Avatar, Button, Col, Flex, Row, Skeleton, Typography } from "antd";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Cover from "../../components/Cover/index";
import { getBaseURL } from "../../https";
import type { Album, Artist, Track } from "../../models";
import { cacheUtils } from "../../utils/cache";
import { usePlayMode } from "../../utils/playMode";
import styles from "./index.module.less";
import SectionOrderModal from "./SectionOrderModal";

const { Title } = Typography;

const CACHE_KEY_RECOMMENDED = "recommended_albums";
const CACHE_KEY_RECENT = "recent_albums";
const CACHE_KEY_ARTISTS = "latest_artists";
const CACHE_KEY_TRACKS = "latest_tracks";
const STORAGE_KEY_ORDER = "recommended_section_order";

interface RecommendedSection {
  id: string;
  title: string;
  items: (Album | Artist | Track)[];
  type: "album" | "artist" | "track";
}

const Recommended: React.FC = () => {
  const navigate = useNavigate();
  const [sections, setSections] = useState<RecommendedSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  // Get current play mode from localStorage
  const { mode: playMode } = usePlayMode();

  // Load initial data whenever playMode changes
  useEffect(() => {
    loadSections();
  }, [playMode]);

  // Debounce resize to re-fetch data based on new width
  const { run: debouncedRefresh } = useDebounceFn(
    () => {
      loadSections(true); // Bypass cache on resize to get correct count
    },
    { wait: 500 },
  );

  useEffect(() => {
    window.addEventListener("resize", debouncedRefresh);
    return () => window.removeEventListener("resize", debouncedRefresh);
  }, [debouncedRefresh]);

  const getCacheKey = (base: string) => `${base}_${playMode}`;

  const sortSections = (
    sectionsToSort: RecommendedSection[],
  ): RecommendedSection[] => {
    try {
      const savedOrder = localStorage.getItem(STORAGE_KEY_ORDER);
      if (savedOrder) {
        const orderIds = JSON.parse(savedOrder) as string[];
        return [...sectionsToSort].sort((a, b) => {
          const indexA = orderIds.indexOf(a.id);
          const indexB = orderIds.indexOf(b.id);
          // If both are in the saved order, sort by index
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          // If only A is in order, it comes first
          if (indexA !== -1) return -1;
          // If only B is in order, it comes first
          if (indexB !== -1) return 1;
          // If neither, keep original order
          return 0;
        });
      }
    } catch (e) {
      console.error("Failed to parse section order:", e);
    }
    return sectionsToSort;
  };

  const getPageSize = (type: "album" | "artist" | "track") => {
    const width = window.innerWidth;
    // Sidebar 200 + Padding 60 (30*2)
    const availableWidth = width - 200 - 60;
    // Album/Track: 170 + 24 (gap) = 194
    // Artist: 110 + 24 (gap) = 134
    const itemWidth = type === "artist" ? 134 : 194;
    return Math.max(4, Math.floor(availableWidth / itemWidth));
  };

  const loadSections = async (forceRefresh = false) => {
    try {
      setLoading(true);

      let recommendedAlbums: Album[] = [];
      let recentAlbums: Album[] = [];
      let latestArtists: Artist[] = [];
      let latestTracks: Track[] = [];

      // Try to get from cache first
      if (!forceRefresh) {
        const cachedRecommended = cacheUtils.get<Album[]>(
          getCacheKey(CACHE_KEY_RECOMMENDED),
        );
        const cachedRecent = cacheUtils.get<Album[]>(
          getCacheKey(CACHE_KEY_RECENT),
        );
        const cachedArtists = cacheUtils.get<Artist[]>(
          getCacheKey(CACHE_KEY_ARTISTS),
        );
        const cachedTracks = cacheUtils.get<Track[]>(
          getCacheKey(CACHE_KEY_TRACKS),
        );

        if (cachedRecommended && cachedRecent && cachedArtists) {
          recommendedAlbums = cachedRecommended;
          recentAlbums = cachedRecent;
          latestArtists = cachedArtists;
          if (playMode === "MUSIC" && cachedTracks) {
            latestTracks = cachedTracks;
          }

          const newSections: RecommendedSection[] = [
            {
              id: "recommended",
              title: "为你推荐",
              items: recommendedAlbums,
              type: "album",
            },
            {
              id: "recent",
              title: "最近上新",
              items: recentAlbums,
              type: "album",
            },
            {
              id: "artists",
              title: "艺术家",
              items: latestArtists,
              type: "artist",
            },
          ];

          if (playMode === "MUSIC") {
            newSections.push({
              id: "tracks",
              title: "上新单曲",
              items: latestTracks,
              type: "track",
            });
          }

          setSections(sortSections(newSections));
          setLoading(false);
          return;
        }
      }

      // Fetch from API with playMode as type parameter
      const type = playMode;
      const albumSize = getPageSize("album");
      const artistSize = getPageSize("artist");
      const trackSize = getPageSize("track");

      const promises: Promise<any>[] = [
        getRecommendedAlbums(type, true, albumSize),
        getRecentAlbums(type, true, albumSize),
        getLatestArtists(type, true, artistSize),
      ];

      if (playMode === "MUSIC") {
        promises.push(getLatestTracks("MUSIC", true, trackSize));
      }

      const results = await Promise.all(promises);
      const recommendedRes = results[0];
      const recentRes = results[1];
      const artistsRes = results[2];
      const tracksRes = playMode === "MUSIC" ? results[3] : null;

      recommendedAlbums = recommendedRes.data || [];
      recentAlbums = recentRes.data || [];
      latestArtists = artistsRes.data || [];
      latestTracks = tracksRes?.data || [];

      const newSections: RecommendedSection[] = [
        {
          id: "recommended",
          title: "为你推荐",
          items: recommendedAlbums,
          type: "album",
        },
        { id: "recent", title: "最近上新", items: recentAlbums, type: "album" },
        {
          id: "artists",
          title: "艺术家",
          items: latestArtists,
          type: "artist",
        },
      ];

      if (playMode === "MUSIC") {
        newSections.push({
          id: "tracks",
          title: "上新单曲",
          items: latestTracks,
          type: "track",
        });
      }

      setSections(sortSections(newSections));

      // Save to cache with type-specific keys
      cacheUtils.set(getCacheKey(CACHE_KEY_RECOMMENDED), recommendedAlbums);
      cacheUtils.set(getCacheKey(CACHE_KEY_RECENT), recentAlbums);
      cacheUtils.set(getCacheKey(CACHE_KEY_ARTISTS), latestArtists);
      if (playMode === "MUSIC") {
        cacheUtils.set(getCacheKey(CACHE_KEY_TRACKS), latestTracks);
      }
    } catch (error) {
      console.error("Failed to load recommended sections:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshSection = async (sectionId: string) => {
    try {
      setRefreshing(sectionId);

      const type = playMode;
      const albumSize = getPageSize("album");
      const artistSize = getPageSize("artist");
      const trackSize = getPageSize("track");

      if (sectionId === "recommended") {
        const res = await getRecommendedAlbums(type, true, albumSize);
        const data = res.data || [];
        updateSection(sectionId, data);
        cacheUtils.set(getCacheKey(CACHE_KEY_RECOMMENDED), data);
      } else if (sectionId === "recent") {
        const res = await getRecentAlbums(type, true, albumSize);
        const data = res.data || [];
        updateSection(sectionId, data);
        cacheUtils.set(getCacheKey(CACHE_KEY_RECENT), data);
      } else if (sectionId === "artists") {
        const res = await getLatestArtists(type, true, artistSize);
        const data = res.data || [];
        updateSection(sectionId, data);
        cacheUtils.set(getCacheKey(CACHE_KEY_ARTISTS), data);
      } else if (sectionId === "tracks") {
        const res = await getLatestTracks("MUSIC", true, trackSize);
        const data = res.data || [];
        updateSection(sectionId, data);
        cacheUtils.set(getCacheKey(CACHE_KEY_TRACKS), data);
      }
    } catch (error) {
      console.error(`Failed to refresh ${sectionId} section:`, error);
    } finally {
      setRefreshing(null);
    }
  };

  const updateSection = (sectionId: string, items: any[]) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId ? { ...section, items } : section,
      ),
    );
  };

  const handleArtistClick = (artistId: number) => {
    navigate(`/artist/${artistId}`);
  };

  const handleSaveOrder = (newOrder: string[]) => {
    localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(newOrder));
    setSections((prev) => {
      const sorted = [...prev].sort((a, b) => {
        const indexA = newOrder.indexOf(a.id);
        const indexB = newOrder.indexOf(b.id);
        return indexA - indexB;
      });
      return sorted;
    });
  };

  // Show skeleton loading on initial load
  if (loading) {
    return (
      <Flex gap={16} vertical className={styles.container}>
        {[1, 2].map((sectionIndex) => (
          <Flex key={sectionIndex} gap={16} vertical>
            <Flex justify="space-between" align="center">
              <Skeleton.Input />
              <Skeleton.Input size="small" />
            </Flex>
            <Flex gap={16}>
              {Array.from({ length: 4 }).map((_, index) => (
                <Cover.Skeleton key={`skeleton-${sectionIndex}-${index}`} />
              ))}
            </Flex>
          </Flex>
        ))}
      </Flex>
    );
  }

  return (
    <div className={styles.container}>
      {sections.map((section) => (
        <div key={section.id} className={styles.section}>
          <div className={styles.sectionHeader}>
            <Title level={3} className={styles.sectionTitle}>
              {section.title}
            </Title>
            <Button
              type="text"
              className={styles.refreshButton}
              onClick={() => refreshSection(section.id)}
              loading={refreshing === section.id}
            >
              换一批 <SyncOutlined spin={refreshing === section.id} />
            </Button>
          </div>

          <Row gutter={[24, 24]}>
            {section.items.map((item: any) => (
              <Col key={item.id}>
                {section.type === "artist" ? (
                  <div
                    className={styles.artistCard}
                    onClick={() => handleArtistClick(item.id)}
                    style={{ cursor: "pointer", textAlign: "center" }}
                  >
                    <Avatar
                      src={
                        item.avatar
                          ? item.avatar.startsWith("http")
                            ? item.avatar
                            : `${getBaseURL()}${item.avatar}`
                          : `https://picsum.photos/seed/${item.id}/300/300`
                      }
                      size={120}
                      icon={!item.avatar && item.name[0]}
                    />
                    <div style={{ marginTop: 8, fontWeight: 500 }}>
                      {item.name}
                    </div>
                  </div>
                ) : section.type === "track" ? (
                  <Cover item={item} isTrack={true} />
                ) : (
                  <Cover item={item} />
                )}
              </Col>
            ))}
          </Row>
        </div>
      ))}

      <div style={{ textAlign: "center", marginTop: 40, marginBottom: 20 }}>
        <Button
          type="dashed"
          icon={<SettingOutlined />}
          onClick={() => setIsOrderModalOpen(true)}
        >
          调整版块顺序
        </Button>
      </div>

      <SectionOrderModal
        visible={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        sections={sections.map((s) => ({ id: s.id, title: s.title }))}
        onSave={handleSaveOrder}
      />
    </div>
  );
};

export default Recommended;

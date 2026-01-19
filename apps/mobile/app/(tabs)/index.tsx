import { usePlayer } from "@/src/context/PlayerContext";
import { EvilIcons, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { getLatestArtists, getLatestTracks, getRecentAlbums, getRecommendedAlbums } from "@soundx/services";
import * as Device from "expo-device";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/context/ThemeContext";
import { getBaseURL } from "../../src/https";
import { cacheUtils } from "../../src/utils/cache";
import { usePlayMode } from "../../src/utils/playMode";

interface Section {
  id: string;
  title: string;
  data: any[];
  type: "artist" | "album" | "track";
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const { playTrack } = usePlayer();
  const { mode, setMode } = usePlayMode();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [tempSections, setTempSections] = useState<Section[]>([]);

  const isTablet = Device.deviceType === Device.DeviceType.TABLET;
  const pageSize = !isTablet ? 8 : 16;

  const loadData = useCallback(
    async (forceRefresh = false) => {
      try {
        if (!forceRefresh) setLoading(true);

        // Try cache first if not refreshing
        if (!forceRefresh) {
          const cachedSections = await cacheUtils.get<Section[]>(
            `home_sections_${mode}`
          );
          if (cachedSections) {
            setSections(cachedSections);
            setSections(cachedSections);
            setLoading(false);
          }
        }

        const promises: Promise<any>[] = [
          getLatestArtists(mode, true, pageSize),
          getRecentAlbums(mode, true, pageSize),
          getRecommendedAlbums(mode, true, pageSize),
        ];
        
        if (mode === "MUSIC") {
          promises.push(getLatestTracks("MUSIC", true, pageSize));
        }

        const results = await Promise.all(promises);
        const [artistsRes, recentRes, recommendedRes] = results;
        const tracksRes = mode === "MUSIC" ? results[3] : null;

        const newSections: Section[] = [
          {
            id: "artists",
            title: "艺术家",
            data: artistsRes.code === 200 ? artistsRes.data : [],
            type: "artist",
          },
          {
            id: "recent",
            title: "最近上新",
            data: recentRes.code === 200 ? recentRes.data : [],
            type: "album",
          },
          {
            id: "recommended",
            title: "为你推荐",
            data: recommendedRes.code === 200 ? recommendedRes.data : [],
            type: "album",
          },
        ];

        if (mode === "MUSIC" && tracksRes?.code === 200) {
          newSections.push({
            id: "tracks",
            title: "上新单曲",
            data: tracksRes.data,
            type: "track",
          });
        }

        // Sort sections based on saved order
        try {
          const savedOrder = await AsyncStorage.getItem("section_order");
          if (savedOrder) {
            const order = JSON.parse(savedOrder);
            newSections.sort((a, b) => {
              const indexA = order.indexOf(a.id);
              const indexB = order.indexOf(b.id);
              if (indexA === -1) return 1;
              if (indexB === -1) return -1;
              return indexA - indexB;
            });
          }
        } catch (e) {
          console.error("Failed to load section order:", e);
        }

        setSections(newSections);
        await cacheUtils.set(`home_sections_${mode}`, newSections);
      } catch (error) {
        console.error("Failed to load home data:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [mode]
  );

  useFocusEffect(
    useCallback(() => {
      const loadOrder = async () => {
        try {
          const savedOrder = await AsyncStorage.getItem("section_order");
          if (savedOrder) {
            const order = JSON.parse(savedOrder);
            setSections((prev) => {
              const newSections = [...prev];
              newSections.sort((a, b) => {
                const indexA = order.indexOf(a.id);
                const indexB = order.indexOf(b.id);
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
              });
              return newSections;
            });
          }
        } catch (e) {
          console.error("Failed to load section order:", e);
        }
      };
      loadOrder();
    }, [])
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  const handleReorder = () => {
    setTempSections([...sections]);
    setModalVisible(true);
  };

  const saveOrder = async () => {
    try {
      const order = tempSections.map((s) => s.id);
      await AsyncStorage.setItem("section_order", JSON.stringify(order));
      setSections(tempSections);
      setModalVisible(false);
    } catch (e) {
      console.error("Failed to save order:", e);
    }
  };

  const renderReorderItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<Section>) => {
    return (
      <ScaleDecorator>
        <TouchableOpacity
          onLongPress={drag}
          disabled={isActive}
          style={[
            styles.modalItem,
            { backgroundColor: isActive ? colors.card : "transparent" },
          ]}
        >
          <Text style={[styles.modalItemText, { color: colors.text }]}>
            {item.title}
          </Text>
          <Ionicons name="menu" size={24} color={colors.secondary} />
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  const refreshSection = async (sectionId: string) => {
    try {
      const sectionIndex = sections.findIndex((s) => s.id === sectionId);
      if (sectionIndex === -1) return;

      let newData: any[] = [];

      if (sectionId === "artists") {
        const res = await getLatestArtists(mode, true, pageSize);
        if (res.code === 200) newData = res.data;
      } else if (sectionId === "recommended") {
        const res = await getRecommendedAlbums(mode, true, pageSize);
        if (res.code === 200) newData = res.data;
      } else if (sectionId === "recent") {
        const res = await getRecentAlbums(mode, true, pageSize);
        if (res.code === 200) newData = res.data;
      } else if (sectionId === "tracks") {
        const res = await getLatestTracks("MUSIC", true, pageSize);
        if (res.code === 200) newData = res.data;
      }

      if (newData.length > 0) {
        setSections((prev) => {
          const newSections = [...prev];
          newSections[sectionIndex] = {
            ...newSections[sectionIndex],
            data: newData,
          };
          return newSections;
        });
      }
    } catch (error) {
      console.error(`Failed to refresh section ${sectionId}:`, error);
    }
  };

  if (loading && !refreshing) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top,
            justifyContent: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>推荐</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => setMode(mode === "MUSIC" ? "AUDIOBOOK" : "MUSIC")}
              style={[styles.modeToggle, { backgroundColor: colors.card }]}
            >
              <Ionicons
                name={mode === "MUSIC" ? "musical-notes" : "headset"}
                size={20}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.searchBar, { backgroundColor: colors.card }]}
          onPress={() => router.push("/search")}
        >
          <Text style={[styles.searchText, { color: colors.secondary }]}>
            搜索单曲，艺术家，专辑
          </Text>
        </TouchableOpacity>

        {sections.map((section) => (
          <View key={section.id}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {section.title}
              </Text>
              <TouchableOpacity onPress={() => refreshSection(section.id)}>
                <EvilIcons name="refresh" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {section.id === "tracks" ? (
              <FlatList
                horizontal
                data={section.data.reduce((resultArray, item, index) => {
                  const chunkIndex = Math.floor(index / 2);
                  if (!resultArray[chunkIndex]) {
                    resultArray[chunkIndex] = [];
                  }
                  resultArray[chunkIndex].push(item);
                  return resultArray;
                }, [] as any[][])}
                renderItem={({ item: columnItems }) => (
                  <View style={styles.trackColumn}>
                    {columnItems.map((track: any) => (
                      <TouchableOpacity
                        key={track.id}
                        style={styles.trackCard}
                        onPress={() => {
                          playTrack(track);
                        }}
                      >
                        <Image
                          source={{
                            uri: track.cover
                              ? `${getBaseURL()}${track.cover}`
                              : `https://picsum.photos/seed/${track.id}/200/200`,
                          }}
                          style={styles.trackImage}
                        />
                        <View style={styles.trackInfo}>
                          <Text
                            style={[styles.trackTitle, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {track.name}
                          </Text>
                          <Text
                            style={[
                              styles.trackArtist,
                              { color: colors.secondary },
                            ]}
                            numberOfLines={1}
                          >
                            {track.artist}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                keyExtractor={(item, index) => `column-${index}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              />
            ) : (
              <FlatList
                horizontal
                data={section.data}
                renderItem={({ item }) => {
                  if (section.type === "artist") {
                    return (
                      <TouchableOpacity
                        style={styles.artistCard}
                        onPress={() => {
                          console.log("Navigating to artist:", item.id);
                          router.push(`/artist/${item.id}`);
                        }}
                      >
                        <Image
                          source={{
                            uri: item.avatar
                              ? `${getBaseURL()}${item.avatar}`
                              : `https://picsum.photos/seed/${item.id}/200/200`,
                          }}
                          style={styles.artistImage}
                        />
                        <Text
                          style={[
                            styles.artistName,
                            { color: colors.secondary },
                          ]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  } else {
                    // Albums (Recent & Recommended)
                    return (
                      <TouchableOpacity
                        style={styles.albumCard}
                        onPress={() => {
                          console.log("Navigating to album:", item.id);
                          router.push(`/album/${item.id}`);
                        }}
                      >
                        <View style={styles.albumImageContainer}>
                          <Image
                            source={{
                              uri: item.cover
                                ? `${getBaseURL()}${item.cover}`
                                : `https://picsum.photos/seed/${item.id}/200/200`,
                            }}
                            style={styles.albumImage}
                          />
                          {(item.type === "AUDIOBOOK" || mode === "AUDIOBOOK") && (item as any).progress > 0 && (
                            <View style={styles.progressOverlay}>
                              <View style={[styles.progressBar, { width: `${item.progress}%`, backgroundColor: colors.primary }]} />
                            </View>
                          )}
                        </View>
                        <Text
                          style={[styles.albumTitle, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <Text
                          style={[
                            styles.albumArtist,
                            { color: colors.secondary },
                          ]}
                          numberOfLines={1}
                        >
                          {item.artist}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                }}
                keyExtractor={(item) => item.id.toString()}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              />
            )}
          </View>
        ))}

        <TouchableOpacity
          style={styles.reorderButton}
          onPress={() =>
            router.push({
              pathname: "/modal",
            })
          }
        >
          <Ionicons name="settings-outline" size={20} color={colors.primary} />
          <Text style={{ color: colors.primary }}>调整顺序</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 12,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  modeToggle: {
    padding: 8,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  searchBar: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 15,
    borderRadius: 10,
  },
  searchText: {},
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 25,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  viewAll: {
    color: "#00ff00",
  },
  horizontalList: {
    paddingHorizontal: 20,
  },
  artistCard: {
    marginRight: 15,
    alignItems: "center",
    width: 100,
  },
  artistImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 8,
  },
  artistName: {
    fontSize: 12,
    textAlign: "center",
  },
  albumCard: {
    marginRight: 15,
    width: 120,
  },
  albumImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
  },
  albumImage: {
    width: 120,
    height: 120,
  },
  progressOverlay: {
    position: 'absolute',
    bottom: 3,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressBar: {
    height: '100%',
  },
  albumTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  albumArtist: {
    fontSize: 12,
  },
  verticalList: {
    paddingHorizontal: 20,
  },
  verticalAlbumCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  verticalAlbumImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  verticalAlbumInfo: {
    flex: 1,
    marginLeft: 15,
  },
  verticalAlbumTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  verticalAlbumArtist: {
    fontSize: 14,
  },
  arrow: {
    fontSize: 20,
  },
  reorderButton: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    padding: 20,
    gap: 8,
    marginTop: 20,
  },
  trackColumn: {
    marginRight: 15,
  },
  trackCard: {
    flexDirection: "row",
    alignItems: "center",
    width: 300,
    marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 10,
    borderRadius: 8,
  },
  trackImage: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  trackInfo: {
    flex: 1,
    marginLeft: 10,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  trackArtist: {
    fontSize: 12,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    width: "80%",
    padding: 20,
    borderRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  modalItemText: {
    fontSize: 16,
  },
  modalControls: {
    flexDirection: "row",
  },
  controlButton: {
    padding: 10,
    marginLeft: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 5,
  },
  disabled: {
    opacity: 0.3,
  },
  saveButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  closeButton: {
    padding: 15,
    alignItems: "center",
    marginTop: 10,
  },
});

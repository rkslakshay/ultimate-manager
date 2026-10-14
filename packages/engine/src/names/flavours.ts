/**
 * Name-generation data per "flavour" (a naming style shared by one or more fictional nations).
 *
 * First names are common given names (not identifying on their own). Surnames and town names
 * are built from morphemes, so full names are invented combinations rather than copies of real
 * people or places. Lists are space-separated strings to keep this data file compact.
 */

export const NAME_FLAVOURS = [
  'latin',
  'nordic',
  'anglo',
  'slavic',
  'lusophone',
  'franco',
  'germanic',
  'westAfrican',
] as const;
export type NameFlavour = (typeof NAME_FLAVOURS)[number];

export interface FlavourData {
  firstNames: string;
  /** Surname = prefix + suffix (most names) or a whole surname from `surnames`. */
  surnamePrefixes: string;
  surnameSuffixes: string;
  surnames: string;
  townPrefixes: string;
  townSuffixes: string;
  /** Club name patterns; `{town}` is replaced with the town name. */
  clubPatterns: string[];
}

export const FLAVOUR_DATA: Record<NameFlavour, FlavourData> = {
  latin: {
    firstNames:
      'Adrián Alberto Alejandro Álvaro Andrés Ángel Bruno Carlos César Cristian Daniel Dario David Diego Eduardo Emilio Enzo Esteban Fabio Federico Felipe Fernando Francisco Gabriel Gonzalo Guillermo Hugo Ignacio Iker Iván Javier Joaquín Jorge Julián Leandro Lorenzo Lucas Luis Marco Mario Martín Mateo Matías Nicolás Óscar Pablo Raúl Ricardo Roberto Rubén Samuel Santiago Sergio Tomás Valentín Víctor',
    surnamePrefixes:
      'Al Bel Cal Cas Cor Del Esc Fal Fer Gal Gar Ib Lar Lor Mal Mar Mon Nav Ol Pal Par Quin Rav Ros Sal Ser Tor Val Ver Vil Zar',
    surnameSuffixes: 'ano ero ez illo edo ales ado ino oza uela era ondo enda arro iz ueta ares',
    surnames:
      'Abarca Belmonte Cabrera Duarte Escobedo Fajardo Galindo Herrera Iturbe Jurado Lozano Medina Navas Ortega Palacios Quesada Robledo Solano Toledano Urquiza Valverde Zamora Arroyo Bermejo Cuesta',
    townPrefixes: 'Al Bel Cas Cor Esp Fuen Gua Lor Mar Mon Ner Ol Pal Rio San Ser Tor Val Vil Zar',
    townSuffixes: 'adura amar ena erna ia illa ona ora uela ares edo ino',
    clubPatterns: [
      'Deportivo {town}',
      'Atlético {town}',
      'Racing {town}',
      'Unión {town}',
      'Sporting {town}',
      'CD {town}',
      '{town} CF',
      'Real {town}',
      'CF {town}',
      'Club {town}',
    ],
  },
  nordic: {
    firstNames:
      'Anders Arne Axel Bjørn Casper Dag Einar Elias Emil Erik Filip Fredrik Gustav Hakon Henrik Isak Jakob Jens Johan Jonas Kasper Kristian Lars Leif Lukas Magnus Martin Mathias Mikkel Nils Oliver Oskar Ove Petter Rasmus Rune Sander Sebastian Sigurd Simon Sindre Steffen Sven Thor Tobias Ulrik Viggo Vidar William',
    surnamePrefixes:
      'Ask Berg Birk Dal Ek Fjell Gran Hag Holm Lind Lunde Mo Nord Ro Sand Sjö Skog Stav Strand Sund Vik Ål Ås',
    surnameSuffixes: 'lund strøm berg dal gaard sen sson rud heim vik qvist bakk',
    surnames:
      'Aasland Brekke Dahle Engen Fossum Grønli Haugland Isaksen Jørgensen Kvamme Lier Myhre Nyland Opsahl Rønning Solheim Tangen Ulvestad Vatne Westby',
    townPrefixes:
      'Ask Bjør Dal Ek Fjor Grim Hal Hval Kvit Lin Ny Ros Sand Skar Sval Tor Ul Var Vest Øst',
    townSuffixes: 'vik by stad borg fjord havn sund holm berg ås',
    clubPatterns: [
      '{town} IF',
      '{town} BK',
      'IK {town}',
      '{town} FF',
      '{town} SK',
      'FK {town}',
      '{town} IL',
      'IFK {town}',
    ],
  },
  anglo: {
    firstNames:
      'Aaron Adam Alex Ben Callum Charlie Connor Dan Dylan Ethan Finn George Harry Harvey Henry Jack Jacob Jake James Jamie Joe Josh Kieran Leo Lewis Liam Luke Mason Matt Max Nathan Noah Oliver Owen Reece Rhys Ryan Sam Scott Sean Theo Toby Tom Tyler Will Zach',
    surnamePrefixes:
      'Ash Black Brad Brook Cart Chap Cran Dun Fair Gar Hart Hay Kent Lang Mars Mill North Pres Ruth Shel Stan Thorn Wake Wey Whit',
    surnameSuffixes: 'ley ford ton well wood worth by shaw combe more field ridge',
    surnames:
      'Abbott Bramwell Carver Dalton Ellery Fenwick Garside Holloway Ingram Jessop Kendrick Lowther Mayhew Norcross Oakes Pritchard Quayle Radley Sowerby Tolland Upton Varley Whitlock Yardley',
    townPrefixes:
      'Ash Brack Brent Cald Cran Dun Elm Fal Glen Hal Hart Kings Lang Mar Mill North Rad Shel Stan Wick',
    townSuffixes: 'ford ton bury field ham wick bridge mouth stead cester',
    clubPatterns: [
      '{town} United',
      '{town} City',
      '{town} Town',
      '{town} Rovers',
      '{town} Athletic',
      '{town} Wanderers',
      '{town} Albion',
      'AFC {town}',
      '{town} FC',
      '{town} Rangers',
    ],
  },
  slavic: {
    firstNames:
      'Aleksandar Andrej Bojan Branko Damir Dario Dejan Dominik Dragan Filip Goran Igor Ivan Jakov Josip Karel Kamil Lazar Luka Marek Marko Matej Milan Miloš Nikola Ognjen Pavel Petar Radek Roman Sava Stefan Tomislav Vladan Vuk Zoran Jan Ondřej Tadeusz Wiktor',
    surnamePrefixes:
      'Bor Dra Gor Hor Jel Kos Kov Kral Lip Mil Nov Ost Pav Rad Ster Stoj Vel Vuk Zel Zor',
    surnameSuffixes: 'ić ović ski ek ar ov enko ak ac in',
    surnames:
      'Babić Cvetko Domazet Hajduk Jurak Kolar Lesar Mrak Ostojić Pejčić Rakić Sedlar Tomek Vranješ Zubač',
    townPrefixes: 'Bel Bor Dub Gor Kam Kral Lip Nov Ost Pol Rad Slav Star Vel Zel',
    townSuffixes: 'grad ovo ica ec in sk ava ov',
    clubPatterns: [
      'FK {town}',
      'NK {town}',
      '{town} Sport',
      'Dinamo {town}',
      'Slavija {town}',
      'Lokomotiva {town}',
    ],
  },
  lusophone: {
    firstNames:
      'André Bernardo Bruno Caio Danilo Diogo Eduardo Fábio Felipe Gonçalo Guilherme Gustavo Henrique Igor João Leonardo Lucas Marcelo Mateus Miguel Nuno Paulo Pedro Rafael Renato Ricardo Rodrigo Rui Thiago Tiago Vinícius Vítor',
    surnamePrefixes: 'Al Bar Cal Car Fer Gou Lou Mac Mar Mor Oli Pin Rib Sil Tav Vas Vie',
    surnameSuffixes: 'eira inho ão ado ares eiro oso ual ena',
    surnames:
      'Amaral Bastos Coutinho Damasceno Esteves Falcão Guerreiro Lacerda Medeiros Nogueira Paixão Quintela Sampaio Teixeira Valadares',
    townPrefixes: 'Al Bel Cam Cas Fig Mar Mon Pon Por Rio San Ser Vale Vila',
    townSuffixes: 'ado eira ela ença ido ões ola',
    clubPatterns: [
      'SC {town}',
      'GD {town}',
      'Desportivo {town}',
      '{town} FC',
      'União {town}',
      'Académico {town}',
    ],
  },
  franco: {
    firstNames:
      'Adrien Alexandre Antoine Arthur Baptiste Benoît Clément Corentin Damien Enzo Étienne Florian Gaël Hugo Jules Julien Kévin Lucas Mathis Maxime Nathan Nicolas Olivier Pierre Quentin Raphaël Romain Simon Théo Thomas Valentin Yann',
    surnamePrefixes: 'Beau Bel Bon Cham Char Du Fon Gar Lam Lan Mar Mont Ro Sau Ver',
    surnameSuffixes: 'champ mont rand ville court lier bert nier tier vin',
    surnames:
      'Aubert Barrault Chevrier Delorme Fauvel Guérin Lemaire Marchand Perrot Roussel Tessier Vidal',
    townPrefixes: 'Beau Bel Char Font Mar Mont Sain Val Ver Ville',
    townSuffixes: 'ville mont court bourg lieu ac',
    clubPatterns: [
      'AS {town}',
      'FC {town}',
      'Stade {town}',
      'Olympique {town}',
      'RC {town}',
      'US {town}',
    ],
  },
  germanic: {
    firstNames:
      'Alexander Andreas Benedikt Christian Dennis Dominik Fabian Felix Florian Jan Jonas Julian Kai Leon Lukas Marcel Marco Matthias Max Moritz Niklas Pascal Patrick Philipp Robin Sebastian Simon Stefan Timo Tobias',
    surnamePrefixes:
      'Alt Bach Berg Brand Eich Feld Hart Hof Kirch Lang Mein Rein Roth Stein Wald Weiss',
    surnameSuffixes: 'mann er hardt berger meier ling hofer bauer ner stadt',
    surnames:
      'Achenbach Brückner Dietrich Fröhlich Grabowski Hennig Kessler Lindner Metzger Pohl Rautenberg Seidel Vogt Wendt',
    townPrefixes: 'Alt Burg Eich Frei Hohen Kirch Neu Ober Rhein Stein',
    townSuffixes: 'burg dorf hausen heim stadt feld',
    clubPatterns: [
      'SV {town}',
      'FC {town}',
      'VfB {town}',
      'TSV {town}',
      '1. FC {town}',
      'SC {town}',
    ],
  },
  westAfrican: {
    firstNames:
      'Abdou Adama Amadou Babacar Bakary Cheikh Daouda Emeka Ibrahima Idrissa Issa Kalidou Kofi Kwame Lamine Mamadou Moussa Obinna Oumar Samba Seydou Souleymane Yaw Yaya Chidi Kelechi Tunde Femi',
    surnamePrefixes: 'Ade Ako Ba Bo Da Diak Kan Ko Mbo Ndi Oko Ou Sa Ta Yo',
    surnameSuffixes: 'ye ba ko ma ne té ra ji wu do',
    surnames:
      'Adebayo Boateng Camara Diallo Fofana Gueye Kouyaté Mensah Ndiaye Okafor Sissoko Traoré',
    townPrefixes: 'Ako Bam Dak Kan Kou Mbo Oua Sen Tam Zin',
    townSuffixes: 'ba ra ko du gou né',
    clubPatterns: ['{town} FC', 'AS {town}', 'Étoile {town}', '{town} Stars', 'Jeunesse {town}'],
  },
};

const cache = new Map<string, string[]>();

/** Split a space-separated list once and memoise. */
export function words(list: string): string[] {
  let out = cache.get(list);
  if (!out) {
    out = list.split(/\s+/).filter(Boolean);
    cache.set(list, out);
  }
  return out;
}

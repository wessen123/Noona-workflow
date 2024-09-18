// service/translation.js or service/translation.ts

export const translateIcelandicChars = (str) => {
  const map = {
    'É': 'E',
    'Í': 'I',
    'Ó': 'O',
    'Ú': 'U',
    'Ý': 'Y',
    'Ð': 'D',
    'Þ': 'Th',
    'á': 'a',
    'é': 'e',
    'í': 'i',
    'ó': 'o',
    'ú': 'u',
    'ý': 'y',
    'ð': 'd',
    'þ': 'th',
    'Æ': 'Ae',
    'æ': 'ae',
    'Ö': 'O',
    'ö': 'o'
  };

  return str.replace(/[ÉÍÓÚÝÐÞáéíóúýðþÆæÖö]/g, (char) => map[char] || char);
};
